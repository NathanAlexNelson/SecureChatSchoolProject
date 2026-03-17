const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "../data/uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

function handleUpload(req, res) {
    let body = [];

    req.on("data", chunk => {
        body.push(chunk);
    });

    req.on("end", () => {
        const buffer = Buffer.concat(body);
        const fileName = "upload_" + Date.now();

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

    const filePath = path.join(uploadDir, fileName);

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        return res.end("File not found");
    }

    const file = fs.createReadStream(filePath);

    res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`
    });

    file.pipe(res);
}

module.exports = {
    handleUpload,
    handleDownload
};