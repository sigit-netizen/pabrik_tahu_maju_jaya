import 'swagger-ui-react/swagger-ui.css';
import SwaggerUI from 'swagger-ui-react';

export default function ApiDocPage() {
  return (
    <section className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Documentation</h1>
      <div className="bg-white rounded shadow p-4">
        <SwaggerUI url="/api/swagger" />
      </div>
    </section>
  );
}
