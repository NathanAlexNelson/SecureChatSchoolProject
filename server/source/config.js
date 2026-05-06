module.exports = {
    HOST: "0.0.0.0", // LAN
    PORT: process.env.PORT || 8443,
    CERT_PATH: "./certs/server-cert.pem",
    KEY_PATH: "./certs/server-key.pem"
};