import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandPublishedCatalogRecords,
  isPhotoSetPublishBlocked,
  publishPhotoSetIfPopulated,
  uploadAndPersistPhotoSetFiles,
} from '../src/lib/photo-set-workflow.ts';

function makeFile(name, bytes) {
  return new File([bytes], name, { type: 'image/jpeg' });
}

function makeStore({ failUploads = new Set(), failMetadataInsert = false } = {}) {
  const objects = new Set();
  const rows = [];
  let photoCount = 0;

  const dependencies = {
    loadRows: async () => ({ data: rows.map((row) => ({ ...row })) }),
    uploadObject: async (path, file) => {
      if (failUploads.has(file.name)) {
        return { error: { message: 'Rejected test upload', statusCode: '413' } };
      }
      if (objects.has(path)) {
        return { error: { message: 'Object already exists', statusCode: '409' } };
      }
      objects.add(path);
      return { error: null };
    },
    insertRows: async (newRows) => {
      if (failMetadataInsert) {
        return { error: { message: 'Metadata insert rejected', code: '42501' } };
      }
      rows.push(...newRows.map((row, index) => ({
        ...row,
        id: `photo-${rows.length + index + 1}`,
      })));
      return { error: null };
    },
    updatePhotoCount: async (count) => {
      photoCount = count;
      return { error: null };
    },
    retryDelay: async () => {},
  };

  return {
    dependencies,
    objects,
    rows,
    get photoCount() {
      return photoCount;
    },
  };
}

test('one photo uploads, persists one metadata row, and sets count from persisted rows', async () => {
  const store = makeStore();
  const result = await uploadAndPersistPhotoSetFiles(
    'content-1',
    [makeFile('one.jpg', 'one')],
    store.dependencies,
  );

  assert.equal(result.persistedCount, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.photoCount, 1);
  assert.equal(store.rows[0].sort_order, 0);
});

test('multiple photos persist N metadata rows and photo_count equals N', async () => {
  const store = makeStore();
  const result = await uploadAndPersistPhotoSetFiles(
    'content-2',
    [
      makeFile('one.jpg', 'one'),
      makeFile('two.jpg', 'two'),
      makeFile('three.jpg', 'three'),
    ],
    store.dependencies,
  );

  assert.equal(result.persistedCount, 3);
  assert.equal(store.rows.length, 3);
  assert.equal(store.photoCount, 3);
  assert.deepEqual(store.rows.map((row) => row.sort_order), [0, 1, 2]);
});

test('same-name files with different contents receive distinct object paths', async () => {
  const store = makeStore();
  await uploadAndPersistPhotoSetFiles(
    'content-2-same-name',
    [
      makeFile('same.jpg', 'first content'),
      makeFile('same.jpg', 'second content'),
    ],
    store.dependencies,
  );

  assert.equal(store.objects.size, 2);
  assert.equal(new Set(store.rows.map((row) => row.storage_path)).size, 2);
});

test('byte-identical selected photos use deterministic distinct paths and resume without duplicates', async () => {
  const store = makeStore();
  const files = [
    makeFile('first.jpg', 'identical bytes'),
    makeFile('second.jpg', 'identical bytes'),
  ];

  const firstAttempt = await uploadAndPersistPhotoSetFiles(
    'content-identical',
    files,
    store.dependencies,
  );
  const retry = await uploadAndPersistPhotoSetFiles(
    'content-identical',
    files,
    store.dependencies,
  );

  assert.equal(firstAttempt.persistedCount, 2);
  assert.equal(retry.persistedCount, 2);
  assert.equal(store.objects.size, 2);
  assert.equal(store.rows.length, 2);
  assert.equal(new Set(store.rows.map((row) => row.storage_path)).size, 2);
});

test('first upload failure cannot publish an empty photo set', async () => {
  const store = makeStore({ failUploads: new Set(['bad.jpg']) });
  const result = await uploadAndPersistPhotoSetFiles(
    'content-3',
    [makeFile('bad.jpg', 'bad')],
    store.dependencies,
  );
  let publishCalled = false;

  const didPublish = await publishPhotoSetIfPopulated(
    async () => ({ count: store.rows.length }),
    async () => {
      publishCalled = true;
      return { error: null };
    },
  );

  assert.equal(result.persistedCount, 0);
  assert.equal(store.photoCount, 0);
  assert.match(result.failedFiles[0], /bad\.jpg: Storage upload/);
  assert.equal(didPublish, false);
  assert.equal(publishCalled, false);
});

test('middle-file failure is identified and retry can recover without duplicating successful photos', async () => {
  const store = makeStore({ failUploads: new Set(['middle.jpg']) });
  const files = [
    makeFile('first.jpg', 'first'),
    makeFile('middle.jpg', 'middle'),
    makeFile('last.jpg', 'last'),
  ];
  const firstAttempt = await uploadAndPersistPhotoSetFiles(
    'content-4',
    files,
    store.dependencies,
  );

  assert.equal(firstAttempt.persistedCount, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.photoCount, 1);
  assert.match(firstAttempt.failedFiles[0], /middle\.jpg/);
  assert.match(firstAttempt.failedFiles[1], /last\.jpg: Not attempted/);
  assert.deepEqual(store.rows.map((row) => row.sort_order), [0]);

  store.dependencies.uploadObject = async (path) => {
    if (store.objects.has(path)) {
      return { error: { message: 'Object already exists', statusCode: 409 } };
    }
    store.objects.add(path);
    return { error: null };
  };
  const retry = await uploadAndPersistPhotoSetFiles(
    'content-4',
    files,
    store.dependencies,
  );

  assert.equal(retry.persistedCount, 3);
  assert.equal(store.rows.length, 3);
  assert.equal(store.objects.size, 3);
  assert.equal(store.photoCount, 3);
  assert.deepEqual(store.rows.map((row) => row.sort_order), [0, 1, 2]);
});

test('metadata insert failure is surfaced with the affected file name and leaves count based on persisted rows', async () => {
  const store = makeStore({ failMetadataInsert: true });
  const result = await uploadAndPersistPhotoSetFiles(
    'content-5',
    [makeFile('metadata-fails.jpg', 'image')],
    store.dependencies,
  );

  assert.equal(result.persistedCount, 0);
  assert.equal(store.rows.length, 0);
  assert.equal(store.photoCount, 0);
  assert.match(result.failedFiles[0], /Photo metadata insert.*metadata-fails\.jpg/);
  assert.match(result.failedFiles[0], /Metadata insert rejected/);
});

test('retry reconciles an already-uploaded object without creating a duplicate', async () => {
  const store = makeStore({ failMetadataInsert: true });
  const file = makeFile('retry.jpg', 'same bytes');
  const firstAttempt = await uploadAndPersistPhotoSetFiles(
    'content-6',
    [file],
    store.dependencies,
  );
  store.dependencies.insertRows = async (newRows) => {
    store.rows.push(...newRows.map((row) => ({ ...row, id: 'recovered' })));
    return { error: null };
  };

  const retry = await uploadAndPersistPhotoSetFiles(
    'content-6',
    [file],
    store.dependencies,
  );

  assert.equal(firstAttempt.persistedCount, 0);
  assert.equal(retry.persistedCount, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.objects.size, 1);
  assert.equal(store.photoCount, 1);
});

test('resume skips an existing legacy photo row with the same sanitized filename', async () => {
  const store = makeStore();
  store.rows.push({
    id: 'legacy',
    content_id: 'content-legacy',
    storage_path: 'content-legacy/001-existing-photo.jpg',
    sort_order: 0,
    alt_text: null,
  });

  const result = await uploadAndPersistPhotoSetFiles(
    'content-legacy',
    [makeFile('existing photo.jpg', 'same existing photo')],
    store.dependencies,
  );

  assert.equal(result.persistedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.objects.size, 0);
  assert.equal(store.photoCount, 1);
});

test('public catalog preserves single-photo and video behavior, expands multi-photo sets, and hides unpublished sets', () => {
  const singlePhoto = {
    id: 'single',
    content_type: 'photo_set',
    content_group: 'solo_pics',
    is_published: true,
    photo_count: 1,
    thumbnail_url: null,
    photo_set_images: [
      { id: 'one', storage_path: 'single/one', sort_order: 0 },
    ],
  };
  const multiPhoto = {
    id: 'multi',
    content_type: 'photo_set',
    content_group: 'solo_pics',
    is_published: true,
    photo_count: 2,
    thumbnail_url: null,
    photo_set_images: [
      { id: 'two', storage_path: 'multi/two', sort_order: 1 },
      { id: 'one', storage_path: 'multi/one', sort_order: 0 },
    ],
  };
  const unpublished = {
    ...multiPhoto,
    id: 'draft',
    is_published: false,
  };
  const video = {
    id: 'video',
    content_type: 'video',
    content_group: 'solo_videos',
    is_published: true,
    photo_count: 0,
    thumbnail_url: 'video-poster',
    photo_set_images: [],
  };
  const publicItems = expandPublishedCatalogRecords(
    [singlePhoto, multiPhoto, unpublished, video],
    (path) => `public/${path}`,
  );

  assert.deepEqual(
    publicItems.map((item) => item.id),
    ['single-one', 'multi-one', 'multi-two', 'video'],
  );
  assert.equal(publicItems[0].thumbnail_url, 'public/single/one');
  assert.equal(publicItems[1].thumbnail_url, 'public/multi/one');
  assert.equal(publicItems[2].thumbnail_url, 'public/multi/two');
  assert.equal(publicItems[3], video);
  assert.equal(publicItems.some((item) => item.id.startsWith('draft-')), false);
});

test('photo-set publish is blocked on count errors or no persisted rows', async () => {
  let publishCalls = 0;

  await assert.rejects(
    publishPhotoSetIfPopulated(
      async () => ({ count: null, error: { message: 'RLS denied', code: '42501' } }),
      async () => {
        publishCalls += 1;
        return { error: null };
      },
    ),
    /Photo metadata verification before publish.*RLS denied/,
  );

  assert.equal(
    await publishPhotoSetIfPopulated(
      async () => ({ count: 0 }),
      async () => {
        publishCalls += 1;
        return { error: null };
      },
    ),
    false,
  );
  assert.equal(publishCalls, 0);
});

test('Studio photo-set publish is blocked while saving and available after save completes', () => {
  assert.equal(isPhotoSetPublishBlocked('photo_set', true), true);
  assert.equal(isPhotoSetPublishBlocked('photo_set', false), false);
  assert.equal(isPhotoSetPublishBlocked('video', true), false);
});
