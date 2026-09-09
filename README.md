# AI Data Masker

AI Data Masker is a local-only browser utility for masking sensitive values in
readable text files before those files are shared with an AI service. It can
later restore the masked values in an AI response using the JSON key generated
during masking.

The application is published from [`docs/`](./docs/) and has no backend,
package manager, framework, CDN, analytics, or network dependency.

## <a href="https://harboot.github.io/AI-Data-Masker/" target="_blank" rel="noopener noreferrer">Open the live preview ↗</a>

The GitHub Pages version performs the same local-only processing as a downloaded
copy: selected files never leave your browser.

> [!WARNING]
> The generated JSON key contains the original sensitive values. Never upload
> the key to an AI service, and store or share it only through a trusted secure
> channel.

## Quick start

1. Download or clone this repository.
2. Open `docs/index.html` directly in a modern browser, or use the live preview
   linked above.
3. No installation, build command, or local web server is required.

## Mask a file

1. In **Mask a file**, select a readable UTF-8 text file. The file picker does
   not restrict extensions.
2. For CSV or TSV data, optionally enter one or more exact column header names
   to replace every value in those columns. Separate headers with commas or new
   lines; only the first-row header is required, not the column's values.
3. Optionally enter custom values, separated by commas or new lines.
4. Select **Mask File**.
5. Review the beginning of the masked result in the full-width local preview
   below both workflow cards. The preview never displays the raw source data.
   CSV, TSV, and arrays of JSON objects are shown as tables; other readable
   files are shown as text.
6. When processing finishes, download both:
   - **Masked File** — the copy intended for the AI service.
   - **JSON Key** — the private data needed to restore masked values.
7. Keep the JSON key private and separate from the masked file.

The masked filename retains the original extension where possible:

| Input | Masked output |
| --- | --- |
| `incident.log` | `incident.masked.log` |
| `events.json` | `events.masked.json` |
| `notes` | `notes.masked.txt` |

## Decode an AI response

1. Save the AI response as a readable UTF-8 text file.
2. In **Decode a response**, select the response file.
3. Select the JSON key produced during the original masking operation.
4. Select **Decode Response**.
5. Download the decoded file when processing finishes.

AI Data Masker intentionally does not perform key-file hash validation. Confirm
that you selected the correct key before using or sharing the decoded output.

## Values detected

AI Data Masker masks the following categories:

- IPv4 addresses, after validating all four octets.
- IPv6 addresses, including compressed notation.
- Email addresses.
- Domains ending in `.com`, `.com.ph`, `.org`, or `.net`.
- Indonesian phone numbers beginning with supported `08` or `62` forms.
- Philippine Phone numbers beginning with `09` or the `63` country code,
  including `+63` and `0063` international forms.
- Indonesian NIK/KTP numbers with a valid encoded day and month.
- Credit card numbers only when the digits pass Luhn validation.
- Philippine TINs in 9-digit form or the usual grouped 12-digit form.
- Philippine SSS numbers in 10-digit or `XX-XXXXXXX-X` form.
- PhilHealth numbers in `XX-XXXXXXXXX-X` form.
- Pag-IBIG MID numbers in `XXXX-XXXX-XXXX` form.
- Any remaining run of 10 or more digits. Only its first 10 digits are masked,
  leaving subsequent digits unchanged.
- User-provided custom values.
- Every value under user-selected CSV or TSV column headers.

### Detection settings

Open **Detection settings** above the masking workflow to enable or disable each
built-in detector. Drag detector rows to change their matching priority. Built-in
definitions are read-only because some of them also perform validation that
cannot be represented by a regular expression alone.

Detection runs sequentially in the displayed order when matches overlap. Phone
and Luhn-valid card detectors are positioned ahead of the Philippine identifier
detectors, while the general long-number detector is last so a more specific
detector gets the first opportunity to mask a value. This order can still be
customized by dragging detector rows.

Use the eye icon beside any detector to view its regex and test it against a sample
value without changing settings. You can also add custom regex detectors, edit their
name, regex, and placeholder prefix, enable or disable them, and delete them. **Custom values** and **Columns to mask** are included in
the panel. All settings are stored only in the browser's local storage and can
be exported to JSON or imported into another browser.

The interface keeps this complete list collapsed by default so it remains
available without crowding the masking form.

Custom values are escaped before regular expressions are created, and longer
custom values are considered first. Overlapping detections are resolved before
replacement. Within one masking operation, every repeated original value in a
category receives the same stable placeholder, for example:

```text
[IP_001]
[DOMAIN_001]
[EMAIL_001]
[PHONE_001]
[PHONE_PH_001]
[NIK_001]
[CARD_001]
[TIN_PH_001]
[SSS_PH_001]
[PHILHEALTH_001]
[PAGIBIG_001]
[LONG_NUMBER_001]
[CUSTOM_001]
```

## JSON key format

The generated key is human-readable JSON with a version, an ISO 8601 creation
timestamp, and a list of mappings:

```json
{
  "version": "1.0",
  "createdAt": "2026-09-06T12:00:00.000Z",
  "mappings": [
    {
      "token": "[EMAIL_001]",
      "original": "private@example.com",
      "type": "EMAIL"
    }
  ]
}
```

The `original` fields are sensitive. The example above is illustrative and is
not generated or transmitted by the application.

## Privacy and local processing

- Files are read with browser file APIs and are never uploaded by the app.
- The page contains no code that performs network requests.
- Masking and response decoding happen entirely in the active browser tab.
- Download links are temporary in-memory object URLs.
- Closing or refreshing the page clears the in-memory masking state. Download
  the key before leaving the page; it cannot be recovered afterward.

For highly sensitive work, use a trusted, up-to-date browser and consider
disconnecting the device from the network before opening the application.

## Large-file behavior

Input files are read in chunks of approximately 4 MiB rather than through a
single full-file text read. A carry-over buffer retains the unfinished trailing
line between chunks so supported values split at a chunk boundary can still be
detected. Processing yields to the browser event loop between chunks and reports
progress in the interface.

The browser still retains generated output pieces in memory until the download
is created. Practical maximum file size therefore depends on available browser
memory. Very large files containing a single line may require additional memory
because that unfinished line remains in the carry-over buffer.

## Browser compatibility

Use a current desktop version of Chrome, Edge, Firefox, or Safari. The app relies
on standard browser capabilities including `Blob`, `TextDecoder`, file slicing,
object URLs, and regular-expression lookbehind.

## Development checks

There is no build process. After editing the application, useful checks include:

```bash
# Validate the application JavaScript syntax with Node.js.
node --check docs/app.js

# Check patch whitespace.
git diff --check
```

GitHub Pages serves the application from `docs/index.html`. Presentation lives
in `docs/styles.css`, and browser behavior lives in `docs/app.js`.

## Security notes

Masking reduces accidental disclosure but is not a guarantee that a document is
anonymous. Review the masked file before sharing it: unsupported identifiers,
names, addresses, contextual clues, and unusual formatting can remain visible.
Also review decoded output before relying on it, because an AI response may alter
or invent placeholder strings.

## License

No license file is currently included. All rights remain with the repository
owner unless a license is added later.
