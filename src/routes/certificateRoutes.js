const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    getCertificates,
    getCertificateById,
    createCertificate,
    deleteCertificate,
    generateCertificatePdf,
} = require('../controllers/certificateController');

// Certificates are normally issued automatically when an enrollment completes
// (see enrollmentController.updateEnrollment) — these routes are for reading
// them back and the rarer manual-issue/revoke cases.
router.get('/', verifyToken, getCertificates); // all roles; controller scopes by role
router.get('/:id', verifyToken, getCertificateById);
router.post('/', verifyToken, requireRole('client_admin'), createCertificate);
// "Build certificate" button — owner (or their company admin) generates the PDF on demand
router.post('/:id/generate', verifyToken, requireRole('user', 'client_admin'), generateCertificatePdf);
router.delete('/:id', verifyToken, requireRole('client_admin', 'platform_admin'), deleteCertificate);

module.exports = router;
