


const users = [
    {
        id: 1,
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin',
        role: 'admin',
        displayName: 'Administrator'
    },
    {
        id: 2,
        username: process.env.USER_USERNAME || 'user',
        password: process.env.USER_PASSWORD || 'user',
        role: 'user',
        displayName: 'Staff Member'
    }
];

module.exports = users;