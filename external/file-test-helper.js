// File test helper FFI — constructs File objects for browser tests
//
// Imported in test modules via:
//   foreign import javascript "external/file-test-helper.js" as FileTestHelperFFI


/**
 * Create a test File object with the given name, text content, and MIME type.
 * The lastModified timestamp is fixed at 2024-01-01T00:00:00Z (1704067200000ms)
 * for deterministic test assertions.
 *
 * @canopy-type String -> String -> String -> File.File
 * @name createTestFile
 */
var createTestFile = F3(function(name, content, mimeType)
{
    return new File([content], name, {
        type: mimeType,
        lastModified: 1704067200000
    });
});
