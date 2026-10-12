require('dotenv').config();
const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const formRoutes = require('./routes/formRoutes');
const companyRoutes = require('./routes/companyRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const answerSetRoutes = require('./routes/answerSetRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Bastion LMS Backend API is running...');
});

app.use('/users', userRoutes);
app.use('/courses', courseRoutes);
app.use('/lessons', lessonRoutes);
app.use('/forms', formRoutes);
app.use('/company', companyRoutes);
app.use('/enrollments', enrollmentRoutes);
app.use('/admin', adminRoutes);
app.use('/uploads', uploadRoutes);
app.use('/modules', moduleRoutes);
app.use('/answer-sets', answerSetRoutes);

// 404 fallback — anything not matched above
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

module.exports = app;
