import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;
