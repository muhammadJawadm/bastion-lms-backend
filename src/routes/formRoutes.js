const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const requireRole = require('../middlewares/requireRole');

const {
    createForm,
    getForms,
    getFormById,
    updateForm,
    deleteForm,
    addPage,
    deletePage,
    addItem,
    updateItem,
    deleteItem,
    addField,
    updateField,
    deleteField,
    addColumn,
    updateColumn,
    deleteColumn,
    submitFormResponse,
    getFormResponses,
    getFormResponseById,
} = require('../controllers/formController');

// Builder writes are client_admin-only; reads are open to client_admin + platform_admin
// (platform_admin is view-only + delete). "user" never touches the builder.
router.post('/', verifyToken, requireRole('client_admin'), createForm);
router.get('/', verifyToken, requireRole('client_admin', 'platform_admin'), getForms);
router.get('/:formId', verifyToken, requireRole('client_admin', 'platform_admin'), getFormById);
router.patch('/:formId', verifyToken, requireRole('client_admin'), updateForm);
router.delete('/:formId', verifyToken, requireRole('client_admin', 'platform_admin'), deleteForm);

// filling out a form is the one form-related thing a mobile "user" can do
router.post('/:formId/responses', verifyToken, requireRole('client_admin', 'user'), submitFormResponse);
router.get('/:formId/responses', verifyToken, requireRole('client_admin', 'platform_admin'), getFormResponses);
router.get('/:formId/responses/:responseId', verifyToken, requireRole('client_admin', 'platform_admin'), getFormResponseById);

router.post('/:formId/pages', verifyToken, requireRole('client_admin'), addPage);
router.delete('/:formId/pages/:pageId', verifyToken, requireRole('client_admin'), deletePage);

router.post('/:formId/pages/:pageId/items', verifyToken, requireRole('client_admin'), addItem);
router.patch('/:formId/pages/:pageId/items/:itemId', verifyToken, requireRole('client_admin'), updateItem);
router.delete('/:formId/pages/:pageId/items/:itemId', verifyToken, requireRole('client_admin'), deleteItem);

router.post('/:formId/pages/:pageId/items/:itemId/fields', verifyToken, requireRole('client_admin'), addField);
router.patch('/:formId/pages/:pageId/items/:itemId/fields/:fieldId', verifyToken, requireRole('client_admin'), updateField);
router.delete('/:formId/pages/:pageId/items/:itemId/fields/:fieldId', verifyToken, requireRole('client_admin'), deleteField);

router.post('/:formId/pages/:pageId/items/:itemId/columns', verifyToken, requireRole('client_admin'), addColumn);
router.patch('/:formId/pages/:pageId/items/:itemId/columns/:columnId', verifyToken, requireRole('client_admin'), updateColumn);
router.delete('/:formId/pages/:pageId/items/:itemId/columns/:columnId', verifyToken, requireRole('client_admin'), deleteColumn);

module.exports = router;
