import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'app', // Folder di mana kita menyimpan API Route (app router)
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Capstone API Documentation',
        version: '1.0.0',
        description: 'Dokumentasi API untuk proyek Capstone',
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [],
    },
  });
  return spec;
};
