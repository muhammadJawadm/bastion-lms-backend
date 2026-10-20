const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    createFormAssignment,
    getFormAssignments,
    deleteFormAssignment,
    getMyForms,
    getMyFormDetails,
} = require('../controllers/formAssignmentController');

// mobile/self "My Forms" — any role, scoped to the caller's own assignments.
// Declared before "/:id" so "my-forms" isn't swallowed as an assignment id.
router.get('/my-forms', verifyToken, getMyForms);
router.get('/my-forms/:formId', verifyToken, getMyFormDetails);

router.post('/', verifyToken, requireRole('client_admin'), createFormAssignment);
router.get('/', verifyToken, requireRole('client_admin', 'platform_admin'), getFormAssignments);
router.delete('/:id', verifyToken, requireRole('client_admin', 'platform_admin'), deleteFormAssignment);

module.exports = router;
