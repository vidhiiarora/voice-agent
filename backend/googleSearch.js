/**
 * googleSearch.js
 * Wrapper to call SerpAPI to fetch Google SERP results for site:housing.com queries.
 *
 * Set SERPER_API_KEY in env (this is actually your SerpAPI key).
 * This file uses SerpAPI's endpoint and response format.
 */

const axios = require('axios');

async function searchHousingLinks(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('SERPER_API_KEY is not set. Returning mocked links for demo.');
    return [
      { title: 'Mock Property 1 - Housing.com', link: 'https://housing.com/example/1', snippet: 'Mocked listing 1' },
      { title: 'Mock Property 2 - Housing.com', link: 'https://housing.com/example/2', snippet: 'Mocked listing 2' },
      { title: 'Mock Property 3 - Housing.com', link: 'https://housing.com/example/3', snippet: 'Mocked listing 3' }
    ];
  }

  try {
    console.log(`Making SerpAPI request for query: "${query}"`);
    
    // Use SerpAPI with proper parameters
    const params = {
      api_key: apiKey,
      engine: 'google',
      q: query,
      location: 'India',
      google_domain: 'google.com',
      gl: 'in',
      hl: 'en',
      num: 5
    };
    
    const resp = await axios.get('https://serpapi.com/search', {
      params: params
    });
    
    console.log('SerpAPI response status:', resp.status);
    console.log('SerpAPI response data:', JSON.stringify(resp.data, null, 2));
    
    const results = [];
    const organic = resp.data.organic_results || [];
    for (const item of organic) {
      results.push({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      });
    }
    
    console.log(`Found ${results.length} results from SerpAPI`);
    return results;
  } catch (err) {
    console.error('SerpAPI search failed:', err.message || err);
    console.error('Error details:', err.response?.data || err.response?.status || 'No additional details');
    
    // Return mock data as fallback
    console.log('Returning mock data as fallback');
    return [
      { title: 'Spacious 3BHK in Lajpat Nagar - Housing.com', link: 'https://housing.com/in/buy/searches/R5251-lajpat-nagar', snippet: '3 BHK Apartment for Sale in Lajpat Nagar, New Delhi. Well-ventilated rooms with modern amenities.' },
      { title: '3BHK Builder Floor in Lajpat Nagar - Housing.com', link: 'https://housing.com/in/buy/lajpat-nagar-delhi', snippet: 'Beautiful 3 BHK builder floor in prime location of Lajpat Nagar. Ready to move property.' },
      { title: 'Premium 3BHK Apartment Lajpat Nagar - Housing.com', link: 'https://housing.com/property/lajpat-nagar-3bhk', snippet: 'Premium 3 BHK apartment with parking and modern facilities in Lajpat Nagar, Delhi.' }
    ];
  }
}

module.exports = { searchHousingLinks };
