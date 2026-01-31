const axios = require('axios');
require('dotenv').config();

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:44962';

async function testRatingsAPI() {
    console.log('Testing Category Ratings API...');
    try {


        const response = await axios.get(`${DASHBOARD_URL}/api/monitoring/ratings`, {
            withCredentials: true

        });

        console.log('Response status:', response.status);
        if (response.data && Array.isArray(response.data)) {
            console.log('Success! Received ratings for', response.data.length, 'categories');
            console.log(JSON.stringify(response.data, null, 2));
        } else {
            console.log('Failed! Unexpected response format:', response.data);
        }
    } catch (error) {
        console.error('API Test Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}


const RatingsService = require('../dashboard/backend/services/ratings.service');
async function internalCheck() {
    console.log('Performing internal service check...');
    try {
        const ratings = await RatingsService.getCategoryRatings();
        console.log('Ratings retrieved successfully:');
        console.table(ratings.map(r => ({
            Category: r.category,
            Avg: r.averageRating,
            Total: r.totalTickets,
            Rated: r.ratedTickets
        })));
    } catch (error) {
        console.error('Internal Check Failed:', error);
    }
}

internalCheck();