// Canopy File FFI — File handling primitives
//
// Imported in File.can, File/Select.can, and File/Download.can via:
//   foreign import javascript "external/file.js" as FileFFI


// DECODER

/**
 * JSON decoder that validates a value is a browser File object.
 * Returns Ok(file) for valid File instances, or a decoding error otherwise.
 * Checks for the existence of the File constructor to handle non-browser
 * environments (e.g. Node.js) gracefully.
 * @canopy-type Json.Decode.Decoder File
 * @name decoder
 * @returns {Object} A JSON decoder for File values
 */
var decoder = _Json_decodePrim(function(value) {
	if (typeof File !== 'undefined' && value instanceof File) {
		return _Result_Ok(value);
	}
	return _Result_Err(
		__canopy_debug
			? { $: 'Failure', a: 'Expecting a FILE', b: __canopy_debug ? { $: 0, a: value } : value }
			: { $: 3, a: 'Expecting a FILE', b: value }
	);
});



// METADATA

/**
 * Get the name of a file as reported by the browser.
 * @canopy-type File -> String
 * @name name
 * @param {File} file - A browser File object
 * @returns {string} The file name
 */
function name(file) { return file.name; }

/**
 * Get the MIME type of a file as reported by the browser.
 * Returns an empty string if the browser cannot determine the type.
 * @canopy-type File -> String
 * @name mime
 * @param {File} file - A browser File object
 * @returns {string} The MIME type string
 */
function mime(file) { return file.type; }

/**
 * Get the size of a file in bytes.
 * @canopy-type File -> Int
 * @name size
 * @param {File} file - A browser File object
 * @returns {number} The file size in bytes
 */
function size(file) { return file.size; }

/**
 * Get the last modified timestamp of a file, converted to a Canopy Time.Posix value.
 * Uses the browser's lastModified property which returns milliseconds since epoch.
 * @canopy-type (Int -> Time.Posix) -> File -> Time.Posix
 * @name lastModified
 * @param {function} millisToPosix - Converts raw milliseconds to a Posix value
 * @param {File} file - A browser File object
 * @returns {Object} A Time.Posix value representing the last modification time
 */
var lastModified = F2(function(millisToPosix, file)
{
	return millisToPosix(file.lastModified);
});


// DOWNLOAD

/**
 * Cached anchor element used for triggering downloads.
 * Reused across download calls to avoid unnecessary DOM allocations.
 */
var _File_downloadNode;

/**
 * Get or create the cached anchor element for downloads.
 * The element is styled to be invisible and appended to the document body
 * so that iOS Safari will honour programmatic clicks on it.
 * @returns {HTMLAnchorElement} A reusable anchor element
 */
function _File_getDownloadNode()
{
	if (!_File_downloadNode)
	{
		_File_downloadNode = document.createElement('a');
		_File_downloadNode.style.display = 'none';
		document.body.appendChild(_File_downloadNode);
	}
	return _File_downloadNode;
}

/**
 * Download content as a file with the given name and MIME type.
 * Creates a Blob from the content, generates an object URL, and triggers
 * a download via a hidden anchor element click.
 *
 * On iOS Safari the object URL is revoked after a short delay so the
 * browser has time to begin the download before the URL is invalidated.
 * @canopy-type String -> String -> a -> b
 * @name download
 * @param {string} name - The file name for the download
 * @param {string} mime - The MIME type of the content
 * @param {*} content - The file content (string or byte array)
 * @returns {Object} A Task that triggers the download
 */
var download = F3(function(name, mime, content)
{
	return _Scheduler_binding(function(callback)
	{
		var blob = new Blob([content], {type: mime});

		var node = _File_getDownloadNode();
		var objectUrl = URL.createObjectURL(blob);
		node.href = objectUrl;
		node.download = name;
		_File_click(node);

		// Delay revocation so iOS Safari has time to initiate the download.
		// Synchronous revocation causes the download to silently fail on iOS.
		setTimeout(function() { URL.revokeObjectURL(objectUrl); }, 1000);

		callback(_Scheduler_succeed(_Utils_Tuple0));
	});
});

/**
 * Download a file from a URL. For same-origin URLs, triggers a direct download.
 * For cross-origin URLs, opens the file in a new tab via target="_blank" to
 * prevent the link from navigating away from the current page.
 * @canopy-type String -> a
 * @name downloadUrl
 * @param {string} href - The URL to download from
 * @returns {Object} A Task that triggers the download
 */
function downloadUrl(href)
{
	return _Scheduler_binding(function(callback)
	{
		var node = _File_getDownloadNode();
		node.href = href;
		node.download = '';
		node.origin === location.origin || (node.target = '_blank');
		_File_click(node);

		callback(_Scheduler_succeed(_Utils_Tuple0));
	});
}


// BLOB COMPATIBILITY

/**
 * Convert Bytes to a Uint8Array for broad browser compatibility.
 * Some browsers cannot create a Blob directly from a DataView, so this
 * extracts the underlying buffer as a Uint8Array first.
 * @canopy-type Bytes -> a
 * @name makeBytesSafeForInternetExplorer
 * @param {DataView} bytes - A DataView representing Bytes
 * @returns {Uint8Array} A Uint8Array suitable for Blob construction
 */
function makeBytesSafeForInternetExplorer(bytes)
{
	return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Simulate a click event on a DOM node. The element is temporarily
 * appended to the document body (if not already attached) so that
 * iOS Safari honours the programmatic click. Without a DOM-attached
 * element, iOS Safari silently ignores dispatchEvent on file inputs
 * and anchor elements.
 * @param {HTMLElement} node - The DOM element to click
 */
function _File_click(node)
{
	var needsAttach = !node.parentNode;
	if (needsAttach)
	{
		node.style.display = 'none';
		document.body.appendChild(node);
	}
	node.dispatchEvent(new MouseEvent('click'));
	if (needsAttach)
	{
		document.body.removeChild(node);
	}
}


// UPLOAD

/**
 * Open a file selection dialog for choosing a single file.
 * Creates a hidden file input element, sets the accepted MIME types,
 * and triggers a click to open the browser's file picker. Resolves
 * with the selected File when the user makes a selection.
 *
 * The input element is appended to the document body while the dialog
 * is open because iOS Safari ignores programmatic clicks on detached
 * file inputs.
 * @canopy-type List String -> a
 * @name uploadOne
 * @param {Object} mimes - A Canopy List of MIME type strings
 * @returns {Object} A Task that resolves with the selected File
 */
function uploadOne(mimes)
{
	return _Scheduler_binding(function(callback)
	{
		var node = document.createElement('input');
		node.type = 'file';
		node.style.display = 'none';
		node.accept = _List_toArray(mimes).join(',');
		document.body.appendChild(node);
		node.addEventListener('change', function(event)
		{
			callback(_Scheduler_succeed(event.target.files[0]));
			document.body.removeChild(node);
		});
		_File_click(node);
	});
}

/**
 * Open a file selection dialog for choosing one or more files.
 * Creates a hidden file input element with the multiple attribute set,
 * configures accepted MIME types, and triggers a click to open the
 * browser's file picker. Resolves with a tuple of (first file, rest)
 * to guarantee at least one file is selected.
 *
 * The FileList is converted to a plain Array before passing to
 * _List_fromArray because FileList is not a true Array and some
 * browsers (notably older iOS Safari) do not support iterating it
 * as one.
 *
 * The input element is appended to the document body while the dialog
 * is open because iOS Safari ignores programmatic clicks on detached
 * file inputs.
 * @canopy-type List String -> a
 * @name uploadOneOrMore
 * @param {Object} mimes - A Canopy List of MIME type strings
 * @returns {Object} A Task that resolves with (File, List File)
 */
function uploadOneOrMore(mimes)
{
	return _Scheduler_binding(function(callback)
	{
		var node = document.createElement('input');
		node.type = 'file';
		node.multiple = true;
		node.style.display = 'none';
		node.accept = _List_toArray(mimes).join(',');
		document.body.appendChild(node);
		node.addEventListener('change', function(event)
		{
			var filesArray = Array.prototype.slice.call(event.target.files);
			var canopyFiles = _List_fromArray(filesArray);
			callback(_Scheduler_succeed(_Utils_Tuple2(canopyFiles.a, canopyFiles.b)));
			document.body.removeChild(node);
		});
		_File_click(node);
	});
}


// CONTENT

/**
 * Read the content of a File (or Blob) as a UTF-8 text string.
 * Uses the FileReader API asynchronously. The returned Task supports
 * cancellation by aborting the FileReader.
 * @canopy-type File -> a
 * @name toString
 * @param {Blob} blob - A File or Blob to read
 * @returns {Object} A Task that resolves with the file content as a string
 */
function toString(blob)
{
	return _Scheduler_binding(function(callback)
	{
		var reader = new FileReader();
		reader.addEventListener('error', function() {
			callback(_Scheduler_fail(reader.error ? reader.error.message : 'File read failed'));
		});
		reader.addEventListener('loadend', function() {
			if (!reader.error) {
				callback(_Scheduler_succeed(reader.result));
			}
		});
		reader.readAsText(blob);
		return function() { reader.abort(); };
	});
}

/**
 * Read the content of a File (or Blob) as raw bytes.
 * Uses the FileReader API to read an ArrayBuffer, then wraps it in a
 * DataView for use as Canopy Bytes. The returned Task supports
 * cancellation by aborting the FileReader.
 * @canopy-type File -> a
 * @name toBytes
 * @param {Blob} blob - A File or Blob to read
 * @returns {Object} A Task that resolves with the file content as Bytes
 */
function toBytes(blob)
{
	return _Scheduler_binding(function(callback)
	{
		var reader = new FileReader();
		reader.addEventListener('error', function() {
			callback(_Scheduler_fail(reader.error ? reader.error.message : 'File read failed'));
		});
		reader.addEventListener('loadend', function() {
			if (!reader.error) {
				callback(_Scheduler_succeed(new DataView(reader.result)));
			}
		});
		reader.readAsArrayBuffer(blob);
		return function() { reader.abort(); };
	});
}

/**
 * Read the content of a File (or Blob) as a Base64-encoded data URL.
 * Uses the FileReader API to produce a string like
 * "data:image/png;base64,..." suitable for use in <img> src attributes
 * and similar contexts. The returned Task supports cancellation by
 * aborting the FileReader.
 * @canopy-type File -> a
 * @name toUrl
 * @param {Blob} blob - A File or Blob to read
 * @returns {Object} A Task that resolves with a data URL string
 */
function toUrl(blob)
{
	return _Scheduler_binding(function(callback)
	{
		var reader = new FileReader();
		reader.addEventListener('error', function() {
			callback(_Scheduler_fail(reader.error ? reader.error.message : 'File read failed'));
		});
		reader.addEventListener('loadend', function() {
			if (!reader.error) {
				callback(_Scheduler_succeed(reader.result));
			}
		});
		reader.readAsDataURL(blob);
		return function() { reader.abort(); };
	});
}
