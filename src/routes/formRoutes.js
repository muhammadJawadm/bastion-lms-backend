const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');

const {
    createForm,
    updateForm,
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
} = require('../controllers/formController');

router.post('/', verifyToken, createForm);
router.patch('/:formId', verifyToken, updateForm);

router.post('/:formId/pages', verifyToken, addPage);
router.delete('/:formId/pages/:pageId', verifyToken, deletePage);

router.post('/:formId/pages/:pageId/items', verifyToken, addItem);
router.patch('/:formId/pages/:pageId/items/:itemId', verifyToken, updateItem);
router.delete('/:formId/pages/:pageId/items/:itemId', verifyToken, deleteItem);

router.post('/:formId/pages/:pageId/items/:itemId/fields', verifyToken, addField);
router.patch('/:formId/pages/:pageId/items/:itemId/fields/:fieldId', verifyToken, updateField);
router.delete('/:formId/pages/:pageId/items/:itemId/fields/:fieldId', verifyToken, deleteField);

router.post('/:formId/pages/:pageId/items/:itemId/columns', verifyToken, addColumn);
router.patch('/:formId/pages/:pageId/items/:itemId/columns/:columnId', verifyToken, updateColumn);
router.delete('/:formId/pages/:pageId/items/:itemId/columns/:columnId', verifyToken, deleteColumn);

module.exports = router;
