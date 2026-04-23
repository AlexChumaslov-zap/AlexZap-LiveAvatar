// PM2 process definition for Cloudways (PHP-stack server with manual Node setup).
// Start with: pm2 start ecosystem.config.js
// Reload after a redeploy: pm2 reload alex-zap --update-env
module.exports = {
  apps: [
    {
      name: "alex-zap",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
