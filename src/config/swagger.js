const swaggerJSDoc = require('swagger-jsdoc');
const authSwagger = require('../SwaggerUi/systemAdmin.js');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Placement CRM API',
    version: '1.0.0',
    description: 'API documentation for Placement CRM backend'
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local server'
    },
    {
      url: 'https://placement-crm.onrender.com',
      description: 'Production server'
    }
  ],
   paths: {
    ...authSwagger.paths,
   
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: [
    './src/routes/**/*.js',
    './src/controllers/**/*.js'
  ]
};

module.exports = swaggerJSDoc(options);
