const PDFDocument = require("pdfkit");

const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

// Builds a simple landscape A4 certificate and resolves with the PDF as a Buffer.
// Minimal on purpose — logo/signature/branding get added to this later.
const buildCertificatePdf = ({ userName, courseTitle, companyName, certificateTitle, certificateNumber, issuedAt, expiresAt }) =>
    new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const { width, height } = doc.page;
        const dark = "#1f2937";
        const muted = "#6b7280";
        const accent = "#b8892b";

        // double border
        doc.lineWidth(3).strokeColor(accent).rect(24, 24, width - 48, height - 48).stroke();
        doc.lineWidth(1).strokeColor(accent).rect(32, 32, width - 64, height - 64).stroke();

        const centered = { width, align: "center" };

        doc.fillColor(accent).font("Helvetica-Bold").fontSize(34)
            .text("CERTIFICATE", 0, 85, { ...centered, characterSpacing: 6 });
        doc.fillColor(muted).font("Helvetica").fontSize(14)
            .text("OF COMPLETION", 0, 128, { ...centered, characterSpacing: 4 });

        doc.fillColor(muted).fontSize(14).text("This is to certify that", 0, 185, centered);

        doc.fillColor(dark).font("Helvetica-Bold").fontSize(36)
            .text(userName || "Participant", 60, 215, { width: width - 120, align: "center" });

        doc.strokeColor(accent).lineWidth(1)
            .moveTo(width / 2 - 140, 268).lineTo(width / 2 + 140, 268).stroke();

        doc.fillColor(muted).font("Helvetica").fontSize(14)
            .text("has successfully completed", 0, 285, centered);

        doc.fillColor(dark).font("Helvetica-Bold").fontSize(24)
            .text(courseTitle || certificateTitle, 80, 315, { width: width - 160, align: "center" });

        if (companyName) {
            doc.fillColor(muted).font("Helvetica").fontSize(13)
                .text(companyName, 0, 375, centered);
        }

        // footer: issued date / certificate number (/ expiry)
        const footerY = height - 105;
        doc.fillColor(muted).font("Helvetica").fontSize(10);
        doc.text("ISSUED", 80, footerY, { width: 200, align: "left" });
        doc.fillColor(dark).fontSize(12).text(formatDate(issuedAt), 80, footerY + 14, { width: 200, align: "left" });

        doc.fillColor(muted).fontSize(10).text("CERTIFICATE NO.", width - 280, footerY, { width: 200, align: "right" });
        doc.fillColor(dark).fontSize(12).text(certificateNumber, width - 280, footerY + 14, { width: 200, align: "right" });

        if (expiresAt) {
            doc.fillColor(muted).fontSize(10).text("VALID UNTIL", 0, footerY, centered);
            doc.fillColor(dark).fontSize(12).text(formatDate(expiresAt), 0, footerY + 14, centered);
        }

        doc.end();
    });

module.exports = { buildCertificatePdf };
