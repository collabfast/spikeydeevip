export type PhotoSetFile = File;

export type PhotoSetImageRow = {
  id?: string;
  content_id: string;
  storage_path: string;
  sort_order: number;
  alt_text: null;
};

type PersistedPhotoSetImage = Pick<
  PhotoSetImageRow,
  "storage_path" | "sort_order"
>;

type SupabaseResult<T> = {
  data?: T | null;
  error?: unknown | null;
  count?: number | null;
};

type PhotoSetUploadDependencies = {
  loadRows: () => Promise<SupabaseResult<PersistedPhotoSetImage[]>>;
  uploadObject: (
    path: string,
    file: PhotoSetFile,
  ) => Promise<SupabaseResult<never>>;
  insertRows: (rows: PhotoSetImageRow[]) => Promise<SupabaseResult<never>>;
  updatePhotoCount: (count: number) => Promise<SupabaseResult<never>>;
  retryDelay?: (milliseconds: number) => Promise<void>;
};

export function photoSetError(stage: string, error: unknown): string {
  const value = error && typeof error === "object"
    ? error as {
      message?: unknown;
      error?: unknown;
      code?: unknown;
      statusCode?: unknown;
      status?: unknown;
    }
    : null;
  const message =
    typeof value?.message === "string" && value.message
      ? value.message
      : typeof value?.error === "string" && value.error
        ? value.error
        : typeof error === "string" && error
          ? error
          : "Unknown error";
  const code = value?.code;
  const status = value?.statusCode ?? value?.status;
  const details = [
    typeof code === "string" || typeof code === "number" ? `code ${code}` : "",
    typeof status === "string" || typeof status === "number"
      ? `status ${status}`
      : "",
  ].filter(Boolean);

  return `${stage}: ${message}${details.length ? ` (${details.join(", ")})` : ""}`;
}

export type PhotoSetUploadResult = {
  persistedCount: number;
  failedFiles: string[];
  skippedCount: number;
};

export const PHOTO_SET_FEED_IMAGE_TRANSFORM = {
  width: 1200,
  quality: 80,
  resize: "contain",
} as const;

export function firstPhotoSetFeedImageId(
  items: ReadonlyArray<{ contentId: string; contentType?: string }>,
): string | undefined {
  return items.find((item) => item.contentType === "photo_set")?.contentId;
}

export function photoSetFeedUrl(
  originalUrl: string,
  createTransformedUrl: () => string,
): string {
  try {
    const transformedUrl = createTransformedUrl();
    if (!transformedUrl.trim()) return originalUrl;
    const parsedUrl = new URL(transformedUrl);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? transformedUrl
      : originalUrl;
  } catch {
    return originalUrl;
  }
}

function isDuplicateObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const value = error as { statusCode?: unknown; status?: unknown };
  const status = value.statusCode ?? value.status;
  return status === 409 || status === "409";
}

export async function photoSetObjectPath(
  contentId: string,
  file: PhotoSetFile,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `${contentId}/${hash}`;
}

function legacyPhotoFileName(storagePath: string): string | null {
  const fileName = storagePath.split("/").pop() ?? "";
  const match = /^\d+-(.+)$/.exec(fileName);
  return match?.[1] ?? null;
}

function safePhotoFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export async function uploadAndPersistPhotoSetFiles(
  contentId: string,
  files: PhotoSetFile[],
  dependencies: PhotoSetUploadDependencies,
): Promise<PhotoSetUploadResult> {
  const existingResult = await dependencies.loadRows();
  if (existingResult.error) {
    throw new Error(
      photoSetError(
        "Photo metadata retrieval (photo_set_images)",
        existingResult.error,
      ),
    );
  }

  const existingPaths = new Set(
    (existingResult.data ?? []).map((row) => row.storage_path),
  );
  const existingLegacyFileNames = new Set(
    (existingResult.data ?? [])
      .map((row) => legacyPhotoFileName(row.storage_path))
      .filter((name): name is string => name !== null),
  );
  const processedPaths = new Set<string>();
  const pathOccurrences = new Map<string, number>();
  const firstSortOrder = Math.max(
    -1,
    ...(existingResult.data ?? []).map((row) => row.sort_order),
  ) + 1;
  const rowsToInsert: PhotoSetImageRow[] = [];
  const insertedFileNames: string[] = [];
  const failedFiles: string[] = [];
  let skippedCount = 0;

  for (const [fileIndex, file] of files.entries()) {
    let baseStoragePath: string;
    try {
      baseStoragePath = await photoSetObjectPath(contentId, file);
    } catch (error) {
      failedFiles.push(
        `${file.name}: ${photoSetError(
          "Photo path preparation (photo-sets)",
          error,
        )}`,
      );
      for (const unattemptedFile of files.slice(fileIndex + 1)) {
        failedFiles.push(
          `${unattemptedFile.name}: Not attempted after an earlier photo failure`,
        );
      }
      break;
    }

    const occurrence = pathOccurrences.get(baseStoragePath) ?? 0;
    pathOccurrences.set(baseStoragePath, occurrence + 1);
    const storagePath = occurrence === 0
      ? baseStoragePath
      : `${baseStoragePath}-${occurrence}`;

    if (
      existingPaths.has(storagePath) ||
      existingLegacyFileNames.has(safePhotoFileName(file.name)) ||
      processedPaths.has(storagePath)
    ) {
      skippedCount += 1;
      continue;
    }

    processedPaths.add(storagePath);
    let uploadError: unknown = null;
    let uploaded = false;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await dependencies.uploadObject(storagePath, file);
        if (!result.error || isDuplicateObjectError(result.error)) {
          uploaded = true;
          break;
        }
        uploadError = result.error;
      } catch (error) {
        uploadError = error;
      }

      if (attempt < 3) {
        await (dependencies.retryDelay ??
          ((milliseconds) =>
            new Promise<void>((resolve) =>
              setTimeout(resolve, milliseconds),
            )))(1_500);
      }
    }

    if (!uploaded) {
      failedFiles.push(
        `${file.name}: ${photoSetError(
          "Storage upload (photo-sets)",
          uploadError,
        )}`,
      );
      for (const unattemptedFile of files.slice(fileIndex + 1)) {
        failedFiles.push(
          `${unattemptedFile.name}: Not attempted after an earlier photo failure`,
        );
      }
      break;
    }

    rowsToInsert.push({
      content_id: contentId,
      storage_path: storagePath,
      sort_order: firstSortOrder + rowsToInsert.length,
      alt_text: null,
    });
    insertedFileNames.push(file.name);
  }

  if (rowsToInsert.length > 0) {
    const insertResult = await dependencies.insertRows(rowsToInsert);
    if (insertResult.error) {
      failedFiles.push(
        photoSetError(
          `Photo metadata insert (photo_set_images; files: ${insertedFileNames.join(", ")})`,
          insertResult.error,
        ),
      );
    }
  }

  const persistedResult = await dependencies.loadRows();
  if (persistedResult.error) {
    throw new Error(
      photoSetError(
        "Photo metadata retrieval after upload (photo_set_images)",
        persistedResult.error,
      ),
    );
  }

  const persistedCount = (persistedResult.data ?? []).length;
  const countResult = await dependencies.updatePhotoCount(persistedCount);
  if (countResult.error) {
    throw new Error(
      photoSetError(
        `Photo count update (videos; ${persistedCount} persisted rows)`,
        countResult.error,
      ),
    );
  }

  return { persistedCount, failedFiles, skippedCount };
}

export async function publishPhotoSetIfPopulated(
  loadPersistedCount: () => Promise<SupabaseResult<never>>,
  publish: () => Promise<SupabaseResult<never>>,
): Promise<boolean> {
  const rowsResult = await loadPersistedCount();
  if (rowsResult.error) {
    throw new Error(
      photoSetError(
        "Photo metadata verification before publish (photo_set_images)",
        rowsResult.error,
      ),
    );
  }

  if (!rowsResult.count) return false;

  const publishResult = await publish();
  if (publishResult.error) {
    throw new Error(photoSetError("Photo set publish (videos)", publishResult.error));
  }

  return true;
}

export function isPhotoSetPublishBlocked(
  contentType: string | undefined,
  saving: boolean,
): boolean {
  return contentType === "photo_set" && saving;
}

export function expandPublishedCatalogRecords<
  T extends {
    id: string;
    content_type?: string;
    is_published: boolean;
    photo_count?: number | null;
    thumbnail_url: string | null;
    photo_set_images?: Array<{
      id: string;
      storage_path: string;
      sort_order: number;
    }>;
  },
>(
  records: T[],
  getPhotoUrls: (path: string) => {
    feedUrl: string;
    originalUrl: string;
  },
): T[] {
  return records
    .filter((record) => record.is_published)
    .flatMap((record) => {
      if (record.content_type !== "photo_set") return [record];

      return [...(record.photo_set_images ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((photo) => {
          const urls = getPhotoUrls(photo.storage_path);
          return {
            ...record,
            id: `${record.id}-${photo.id}`,
            thumbnail_url: urls.originalUrl,
            feed_thumbnail_url: urls.feedUrl,
            photo_count: 1,
          };
        });
    });
}
