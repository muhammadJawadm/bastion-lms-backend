const jwt = require('jsonwebtoken');

const generateToken = (userId, role="user", companyId=null) => {
    return jwt.sign({ id:userId, role, companyId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { generateToken };