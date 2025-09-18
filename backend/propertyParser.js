/**
 * propertyParser.js
 * Service to parse property details from Housing.com URLs
 */

const axios = require('axios');

class PropertyParserService {
  async parsePropertyUrl(url) {
    try {
      console.log(`Parsing property URL: ${url}`);
      
      // Validate URL
      if (!url || !url.includes('housing.com')) {
        throw new Error('Invalid Housing.com URL');
      }

      // For now, we'll extract basic info from URL patterns and return mock data
      // In production, you'd use web scraping or Housing.com API
      const propertyInfo = this.extractInfoFromUrl(url);
      
      // Try to fetch page content (simplified version)
      try {
        const response = await axios.get(url, {
          timeout: 15000,
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        
        // Basic HTML parsing (you could use cheerio for better parsing)
        const htmlContent = response.data;
        const enhancedInfo = this.parseHtmlContent(htmlContent, propertyInfo);
        console.log('Successfully parsed property from URL');
        return enhancedInfo;
        
      } catch (fetchError) {
        console.warn('Could not fetch property page, using URL-based info:', fetchError.message);
        // Return enriched URL-based info as fallback
        return this.enrichPropertyInfo(propertyInfo);
      }
      
    } catch (error) {
      console.error('Property parsing error:', error);
      throw error;
    }
  }

  extractInfoFromUrl(url) {
    const info = { url };
    
    // Extract location from URL patterns
    const locationMatch = url.match(/(?:buy|rent)-(?:flats?|houses?|property)-in-([^-/]+)/i);
    if (locationMatch) {
      info.location = this.formatLocation(locationMatch[1]);
    }
    
    // Extract BHK from URL
    const bhkMatch = url.match(/(\d+)bhk/i);
    if (bhkMatch) {
      info.bhk = `${bhkMatch[1]} BHK`;
    }
    
    // Extract property type
    if (url.includes('/buy/') || url.includes('for-sale')) {
      info.type = 'Sale';
    } else if (url.includes('/rent/') || url.includes('for-rent')) {
      info.type = 'Rent';
    }
    
    // Set default title
    info.title = `${info.bhk || 'Property'} ${info.type ? 'for ' + info.type : ''} in ${info.location || 'Prime Location'}`;
    
    return info;
  }

  parseHtmlContent(html, baseInfo) {
    const info = { ...baseInfo };
    
    try {
      // Extract title (look for common title patterns)
      const titleMatches = [
        /<title[^>]*>([^<]+)</i,
        /<h1[^>]*>([^<]+)</i,
        /property["\s]*title["\s]*[:"']([^"'<]+)/i
      ];
      
      for (const pattern of titleMatches) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].trim().length > 10) {
          info.title = this.cleanText(match[1]);
          break;
        }
      }
      
      // Extract price (look for price patterns)
      const pricePatterns = [
        /₹\s*([\d,]+)\s*(?:lakh|crore|L|Cr)/gi,
        /price["\s]*[:"']?[^\d]*₹\s*([\d,]+)/i,
        /(?:₹|rs\.?\s*|inr\s*)([\d,]+)\s*(?:lakh|crore|l|cr)/i
      ];
      
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          info.price = '₹' + this.formatPrice(match[1]);
          break;
        }
      }
      
      // Extract area/size
      const areaPatterns = [
        /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i,
        /area["\s]*[:"']?[^\d]*([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i
      ];
      
      for (const pattern of areaPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          info.area = `${match[1]} sq ft`;
          break;
        }
      }
      
      // Extract amenities (simplified)
      if (html.toLowerCase().includes('swimming pool')) {
        info.amenities = (info.amenities || '') + 'Swimming Pool, ';
      }
      if (html.toLowerCase().includes('parking')) {
        info.amenities = (info.amenities || '') + 'Parking, ';
      }
      if (html.toLowerCase().includes('gym') || html.toLowerCase().includes('fitness')) {
        info.amenities = (info.amenities || '') + 'Gym, ';
      }
      if (html.toLowerCase().includes('security')) {
        info.amenities = (info.amenities || '') + 'Security, ';
      }
      
      if (info.amenities) {
        info.amenities = info.amenities.replace(/,\s*$/, ''); // Remove trailing comma
      }
      
    } catch (parseError) {
      console.warn('HTML parsing error:', parseError.message);
    }
    
    return info;
  }

  formatLocation(location) {
    return location
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatPrice(priceStr) {
    const cleanPrice = priceStr.replace(/,/g, '');
    const num = parseInt(cleanPrice);
    
    if (num >= 10000000) { // 1 crore
      return `${(num / 10000000).toFixed(1)} Crore`;
    } else if (num >= 100000) { // 1 lakh
      return `${(num / 100000).toFixed(1)} Lakh`;
    } else {
      return `${num.toLocaleString('en-IN')}`;
    }
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-₹]/g, '')
      .trim()
      .substring(0, 100); // Limit length
  }

  // Enrich property info with better defaults when URL parsing is available
  enrichPropertyInfo(propertyInfo) {
    const enriched = { ...propertyInfo };
    
    // Add default price if not present
    if (!enriched.price) {
      if (enriched.type === 'Rent') {
        enriched.price = '₹25,000/month';
      } else {
        enriched.price = '₹65 Lakh';
      }
    }
    
    // Add default area if not present
    if (!enriched.area) {
      if (enriched.bhk && enriched.bhk.includes('1')) {
        enriched.area = '650 sq ft';
      } else if (enriched.bhk && enriched.bhk.includes('2')) {
        enriched.area = '950 sq ft';
      } else if (enriched.bhk && enriched.bhk.includes('3')) {
        enriched.area = '1200 sq ft';
      } else {
        enriched.area = '850 sq ft';
      }
    }
    
    // Add default amenities if not present
    if (!enriched.amenities) {
      enriched.amenities = 'Parking, Security, Power Backup';
    }
    
    return enriched;
  }

  // Generate sample property data for demo
  generateSampleProperty(url) {
    const sampleProperties = [
      {
        title: '3 BHK Luxury Apartment for Sale in Lajpat Nagar',
        price: '₹85 Lakh',
        location: 'Lajpat Nagar, Delhi',
        bhk: '3 BHK',
        area: '1200 sq ft',
        type: 'Sale',
        amenities: 'Parking, Security, Power Backup',
        url: url
      },
      {
        title: '2 BHK Ready to Move Flat in Pune',
        price: '₹65 Lakh',
        location: 'Wakad, Pune',
        bhk: '2 BHK',
        area: '950 sq ft',
        type: 'Sale',
        amenities: 'Swimming Pool, Gym, Club House',
        url: url
      },
      {
        title: '1 BHK Premium Apartment for Rent',
        price: '₹25,000/month',
        location: 'Koramangala, Bangalore',
        bhk: '1 BHK',
        area: '650 sq ft',
        type: 'Rent',
        amenities: 'Furnished, AC, WiFi Ready',
        url: url
      }
    ];
    
    return sampleProperties[Math.floor(Math.random() * sampleProperties.length)];
  }
}

module.exports = new PropertyParserService();