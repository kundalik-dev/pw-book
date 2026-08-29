import path from 'node:path';
import express, { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

export const docsRouter = Router();

// Raw OpenAPI YAML source tree (apps/api/../../api-swagger) — served as static
// files so Swagger UI's client-side loader can resolve the spec's relative
// $refs itself via plain HTTP requests, with no server-side bundling step.
docsRouter.use('/docs-src', express.static(path.resolve(__dirname, '../../../../api-swagger')));

// Default Swagger UI renders edge-to-edge with tight padding; this centers
// the content in a narrower, breathing-room column instead.
const customCss = `
  body { background: #f6f8fa; }
  .swagger-ui .wrapper { max-width: 1120px; padding: 0 24px; }
  .swagger-ui .information-container { padding: 32px 0 16px; }
  .swagger-ui .scheme-container {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
    margin: 24px auto;
    padding: 20px 24px;
  }
  .swagger-ui .opblock-tag-section { margin-bottom: 12px; }
  .swagger-ui .opblock { border-radius: 8px; margin: 0 0 12px; }
  .swagger-ui section.models { border-radius: 10px; margin: 24px 0; }
`;

docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerOptions: { url: '/api/docs-src/openapi.yaml' },
    customSiteTitle: 'pw-books API docs',
    customCss,
  }),
);
