# api-swagger

OpenAPI 3.0 documentation for the pw-books API (`apps/api`). This is a plain
spec — no server or build step of its own — built incrementally, one module
at a time, matching the API's route groups (`auth`, `books`, `authors`, …).

## Structure

```
api-swagger/
  openapi.yaml              root document: info, servers, tags, and a
                             paths/components index that $refs the files below
  paths/<module>/*.yaml      one Path Item file per endpoint
  components/schemas/*.yaml  one schema file per request/response shape
```

Currently documented: **Auth → register** (`POST /auth/register`) and
**Auth → login** (`POST /auth/login`). Other modules will be added the same
way as they're written up.

## Previewing

Any OpenAPI 3 viewer that resolves relative `$ref`s works, e.g.:

```
npx @redocly/cli preview-docs api-swagger/openapi.yaml
```

or lint it with:

```
npx @redocly/cli lint api-swagger/openapi.yaml
```
