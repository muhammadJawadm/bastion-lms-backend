module.exports = {
  apps: [
    {
      name: 'bastion-lms-backend',
      script: 'server.js',        // your entry point
      watch: true,                     // acts like nodemon
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log'
      ],
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};