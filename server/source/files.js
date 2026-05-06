const fs = require("fs");
const path = require("path");
const { validate_sesh } = require("./sessions");
const base = process.env.NODE_ENV === "production" ? path.join(__dirname, "..") : path.dirname(process.execPath);

const uploadDir = path.join(base, "data/uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

function handleUpload(req, res) {
    // validate uploader's session 
    const token = req.headers["authorization"]?.replace("Sender ", "");
    const sesh = validate_sesh(token);
    if (!sesh) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "unauthorized session" }));
    }
    let body = [];

    // size limit added to prevent crashing
    req.on("data", chunk => {
        body.push(chunk);
        const total = body.reduce((acc, c) => acc + c.length, 0);
        if (total > 10 * 1024 * 1024) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "File too large" }));
            req.destroy();
        } 
    });

    req.on("end", () => {
        const buffer = Buffer.concat(body);
        const OGname = req.headers["x-filename"] || "file"; // hotfix
        const fileName = `upload_${Date.now()}_${OGname}`;

        const filePath = path.join(uploadDir, fileName);

        fs.writeFileSync(filePath, buffer);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            message: "File uploaded",
            file: fileName
        }));
    });
}

function handleDownload(req, res, fileName) {

    const safe = path.basename(fileName); // path traversal handling
    const filePath = path.join(uploadDir, safe);

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end("File not found");
    }

    const file = fs.createReadStream(filePath);

    res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(fileName)}"`
    });

    file.pipe(res);
}

module.exports = {
    handleUpload,
    handleDownload
};