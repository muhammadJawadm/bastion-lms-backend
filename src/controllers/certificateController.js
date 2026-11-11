const Certificate = require("../models/Certificates");
const User = require("../models/User");
const Course = require("../models/Courses");
const Company = require("../models/Company");
const cloudinary = require("../config/cloudinary");
const { buildCertificatePdf } = require("../utils/certificatePdf");

const generateCertificateNumber = () =>
    `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// Called from enrollmentController when an enrollment newly completes and its
// course has issuesCertificate: true — not a route itself. Idempotent: never
// issues a second certificate for the same enrollment.
exports.issueCertificateIfEligible = async (enrollment, course) => {
    if (!course || !course.issuesCertificate) return null;

    const existing = await Certificate.findOne({ enrollmentId: enrollment._id });
    if (existing) return existing;

    return Certificate.create({
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        enrollmentId: enrollment._id,
        companyId: enrollment.companyId,
        certificateTitle: course.certificateTitle || `${course.title} - Certificate of Completion`,
        certificateNumber: generateCertificateNumber(),
        score: enrollment.progressPct,
        issuedAt: new Date(),
    });
};

// GET /certificates?companyId=&userId=&courseId=
// client_admin: own company only. platform_admin: any (companyId optional).
// user: only ever their own (userId is forced to their own id).
exports.getCertificates = async (req, res) => {
    try {
        let companyId = req.query.companyId;
        if (req.user.role === 'client_admin') companyId = req.user.companyId;

        let userId = req.query.userId;
        if (req.user.role === 'user') userId = req.user.id;

        if (!companyId && req.user.role !== 'platform_admin') {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const filter = {};
        if (companyId) filter.companyId = companyId;
        if (userId) filter.userId = userId;
        if (req.query.courseId) filter.courseId = req.query.courseId;

        const certificates = await Certificate.find(filter).sort({ issuedAt: -1 });
        res.status(200).json({ success: true, data: certificates });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /certificates/:id
exports.getCertificateById = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) {
            return res.status(404).json({ message: "Certificate not found" });
        }

        if (req.user.role === 'user' && String(certificate.userId) !== String(req.user.id)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (req.user.role === 'client_admin' && String(certificate.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        res.status(200).json({ success: true, data: certificate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

const uploadPdfToCloudinary = (buffer, publicId) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "bastion-lms/certificates",
                public_id: publicId,
                resource_type: "raw", // raw delivery serves the PDF as-is (no image-type PDF restrictions)
                overwrite: true,
            },
            (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(buffer);
    });

// POST /certificates/:id/generate
// The "Build certificate" button. Renders the certificate PDF, uploads it to
// Cloudinary and saves the URL in pdfUrl. Idempotent: if the PDF already
// exists it just returns the certificate, so a double tap never builds twice.
// The request stays open while the PDF is built — the app shows "preparing…".
exports.generateCertificatePdf = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) {
            return res.status(404).json({ message: "Certificate not found" });
        }

        if (req.user.role === 'user' && String(certificate.userId) !== String(req.user.id)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (req.user.role === 'client_admin' && String(certificate.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (certificate.pdfUrl) {
            return res.status(200).json({ success: true, message: "Certificate already generated", data: certificate });
        }

        const [user, course, company] = await Promise.all([
            User.findById(certificate.userId).select("name").lean(),
            certificate.courseId ? Course.findById(certificate.courseId).select("title").lean() : null,
            certificate.companyId ? Company.findById(certificate.companyId).select("name").lean() : null,
        ]);

        const pdfBuffer = await buildCertificatePdf({
            userName: user && user.name,
            courseTitle: course && course.title,
            companyName: company && company.name,
            certificateTitle: certificate.certificateTitle,
            certificateNumber: certificate.certificateNumber,
            issuedAt: certificate.issuedAt || certificate.createdAt,
            expiresAt: certificate.expiresAt,
        });

        const result = await uploadPdfToCloudinary(pdfBuffer, `${certificate.certificateNumber}.pdf`);

        certificate.pdfUrl = result.secure_url;
        await certificate.save();

        res.status(200).json({ success: true, message: "Certificate generated successfully", data: certificate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Server error" });
    }
};

// POST /certificates  (client_admin only — route-gated)
// Manual issuance, for cases outside the auto-issue-on-completion path
// (e.g. an in-person training tracked without a full course/enrollment).
exports.createCertificate = async (req, res) => {
    try {
        const { userId, courseId, enrollmentId, certificateTitle, score, issuedAt, expiresAt, pdfUrl } = req.body;
        const companyId = req.user.companyId;

        if (!userId || !certificateTitle) {
            return res.status(400).json({ message: "userId and certificateTitle are required" });
        }

        const certificate = await Certificate.create({
            userId,
            courseId,
            enrollmentId,
            companyId,
            certificateTitle,
            certificateNumber: generateCertificateNumber(),
            score: score || 0,
            issuedAt: issuedAt || new Date(),
            expiresAt: expiresAt || null,
            pdfUrl: pdfUrl || null,
        });

        res.status(201).json({ success: true, message: "Certificate issued successfully", data: certificate });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// DELETE /certificates/:id  (client_admin own company, or platform_admin any)
exports.deleteCertificate = async (req, res) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) {
            return res.status(404).json({ message: "Certificate not found" });
        }
        if (req.user.role === 'client_admin' && String(certificate.companyId) !== String(req.user.companyId)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await Certificate.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Certificate deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
