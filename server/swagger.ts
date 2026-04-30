import type { Express } from 'express';
import listEndpoints from 'express-list-endpoints';
import swaggerUi from 'swagger-ui-express';

type OpenApiMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

function normalizePath(path: string): string {
	return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function createTagFromPath(path: string): string {
	const segments = path.split('/').filter(Boolean);
	if (segments.length >= 2 && segments[0] === 'api') {
		return segments[1];
	}
	return 'general';
}

function toOperationId(method: string, endpointPath: string): string {
	const clean = endpointPath
		.replace(/[{}]/g, '')
		.split('/')
		.filter(Boolean)
		.map((part) => part.replace(/[^A-Za-z0-9_]/g, '_'))
		.join('_');
	return `${method.toLowerCase()}_${clean || 'root'}`;
}

function isPublicEndpoint(endpointPath: string): boolean {
	return (
		endpointPath.includes('/public') ||
		endpointPath.includes('/login') ||
		endpointPath.includes('/forgot-password') ||
		endpointPath.endsWith('/stream') ||
		endpointPath.includes('/vapid-key') ||
		endpointPath.includes('/subscription-status')
	);
}

function inferSecurity(endpointPath: string) {
	if (!endpointPath.startsWith('/api')) return [];
	if (isPublicEndpoint(endpointPath)) return [];
	return [{ bearerAuth: [] }, { cookieAuth: [] }];
}

function extractPathParameters(endpointPath: string) {
	const params: any[] = [];
	const regex = /\{([A-Za-z0-9_]+)\}/g;
	let match = regex.exec(endpointPath);
	while (match) {
		params.push({
			name: match[1],
			in: 'path',
			required: true,
			description: `Path parameter ${match[1]}`,
			schema: { type: 'string' },
			example: match[1].toLowerCase().includes('id')
				? '67f0f5fbb0f4f12bc1234567'
				: 'example',
		});
		match = regex.exec(endpointPath);
	}
	return params;
}

function buildOpenApiDocument(app: Express) {
	const endpoints = listEndpoints(app as any);
	const paths: Record<string, Record<string, any>> = {};

	for (const endpoint of endpoints) {
		const normalizedPath = normalizePath(endpoint.path);
		if (!paths[normalizedPath]) paths[normalizedPath] = {};

		for (const methodRaw of endpoint.methods) {
			const method = methodRaw.toLowerCase() as OpenApiMethod;
			const hasBody = ['post', 'put', 'patch'].includes(method);
			const operation: any = {
				tags: [createTagFromPath(endpoint.path)],
				summary: `${methodRaw} ${endpoint.path}`,
				operationId: toOperationId(methodRaw, normalizedPath),
				parameters: extractPathParameters(normalizedPath),
				security: inferSecurity(normalizedPath),
				responses: {
					'200': {
						description: 'Berhasil',
						content: {
							'application/json': {
								schema: { $ref: '#/components/schemas/SuccessResponse' },
							},
						},
					},
					'400': { $ref: '#/components/responses/BadRequest' },
					'401': { $ref: '#/components/responses/Unauthorized' },
					'403': { $ref: '#/components/responses/Forbidden' },
					'404': { $ref: '#/components/responses/NotFound' },
					'422': { $ref: '#/components/responses/ValidationError' },
					'429': { $ref: '#/components/responses/TooManyRequests' },
					'500': { $ref: '#/components/responses/InternalServerError' },
					'503': { $ref: '#/components/responses/ServiceUnavailable' },
				},
			};

			if (!operation.parameters.length) delete operation.parameters;
			if (!operation.security.length) delete operation.security;
			if (hasBody) {
				operation.requestBody = {
					required: true,
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/GenericRequestBody' },
						},
					},
				};
			}

			paths[normalizedPath][method] = operation;
		}
	}

	return {
		openapi: '3.0.3',
		info: {
			title: 'HMPS API',
			version: '1.0.0',
			description:
				'Dokumentasi API otomatis dengan reusable error response, security scheme, dan contoh payload dasar.',
		},
		servers: [
			{
				url: '/',
			},
		],
		security: [{ bearerAuth: [] }, { cookieAuth: [] }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
				},
				cookieAuth: {
					type: 'apiKey',
					in: 'cookie',
					name: 'token',
				},
			},
			schemas: {
				SuccessResponse: {
					type: 'object',
					additionalProperties: true,
					properties: {
						message: { type: 'string', example: 'OK' },
					},
				},
				GenericRequestBody: {
					type: 'object',
					additionalProperties: true,
				},
				ErrorResponse: {
					type: 'object',
					required: ['message'],
					properties: {
						message: { type: 'string', example: 'Internal Server Error' },
						code: { type: 'string', example: 'INTERNAL_ERROR' },
						errors: {
							type: 'array',
							items: { $ref: '#/components/schemas/ValidationIssue' },
						},
					},
				},
				ValidationIssue: {
					type: 'object',
					properties: {
						field: { type: 'string', example: 'email' },
						message: { type: 'string', example: 'Email tidak valid' },
					},
				},
			},
			responses: {
				BadRequest: {
					description: 'Request tidak valid',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				Unauthorized: {
					description: 'Belum login atau token tidak valid',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				Forbidden: {
					description: 'Tidak punya izin untuk aksi ini',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				NotFound: {
					description: 'Resource tidak ditemukan',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				ValidationError: {
					description: 'Validasi gagal',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				TooManyRequests: {
					description: 'Terlalu banyak request',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				InternalServerError: {
					description: 'Terjadi kesalahan internal server',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
				ServiceUnavailable: {
					description: 'Layanan sementara tidak tersedia',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
				},
			},
		},
		paths,
	};
}

export function setupSwagger(app: Express) {
	const openApiDocument = buildOpenApiDocument(app);

	app.get('/api-docs.json', (_req, res) => {
		res.json(openApiDocument);
	});

	app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
}
