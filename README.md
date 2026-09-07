# AI Data Master

AI Data Master is a local-only browser utility for masking sensitive values in
readable text files before those files are shared with an AI service. It can
later restore the masked values in an AI response using the JSON key generated
during masking.

The complete application is contained in
[`ai-data-master.html`](./ai-data-master.html). It has no backend, package
manager, framework, CDN, analytics, or network dependency.

> [!WARNING]
> The generated JSON key contains the original sensitive values. Never upload
> the key to an AI service, and store or share it only through a trusted secure
> channel.

## Quick start

1. Download or clone this repository.
2. Open `ai-data-master.html` directly in a modern browser.
3. No installation, build command, or local web server is required.

## Mask a file

1. In **Mask a file**, select a readable UTF-8 text file. The file picker does
   not restrict extensions.
2. Review the beginning of the file in the local preview. CSV, TSV, and arrays
   of JSON objects are shown as tables; other readable files are shown as text.
3. For CSV or TSV data, optionally enter one or more exact column header names
   to replace every value in those columns. Separate headers with commas or new
   lines; only the first-row header is required, not the column's values.
4. Optionally enter custom values, separated by commas or new lines.
5. Select **Mask File**.
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

AI Data Master intentionally does not perform key-file hash validation. Confirm
that you selected the correct key before using or sharing the decoded output.

## Values detected

AI Data Master masks the following categories:

- IPv4 addresses, after validating all four octets.
- IPv6 addresses, including compressed notation.
- Email addresses.
- Domains ending in `.com`, `.com.ph`, `.org`, or `.net`.
- Indonesian phone numbers beginning with supported `08` or `62` forms.
- Philippine mobile numbers beginning with `09` or the `63` country code,
  including `+63` and `0063` international forms.
- Credit card numbers only when the digits pass Luhn validation.
- User-provided custom values.
- Every value under user-selected CSV or TSV column headers.

The interface keeps this complete list collapsed by default so it remains
available without crowding the masking form.

It deliberately does **not** detect or mask:

- Indonesian NIK/KTP numbers.
- Passwords, secrets, API keys, or authentication tokens.
- Domains using top-level domains outside the supported list.
- Binary or non-UTF-8 files.

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
[CARD_001]
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
# Validate the embedded JavaScript syntax with Node.js.
node - <<'NODE'
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('ai-data-master.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
console.log('JavaScript syntax OK');
NODE

# Check patch whitespace.
git diff --check
```

Because the app is intentionally self-contained, application changes should
remain inside `ai-data-master.html`. Supporting project documentation may be
maintained as Markdown files in the repository root.

## Security notes

Masking reduces accidental disclosure but is not a guarantee that a document is
anonymous. Review the masked file before sharing it: unsupported identifiers,
names, addresses, contextual clues, and unusual formatting can remain visible.
Also review decoded output before relying on it, because an AI response may alter
or invent placeholder strings.

## License

No license file is currently included. All rights remain with the repository
owner unless a license is added later.
