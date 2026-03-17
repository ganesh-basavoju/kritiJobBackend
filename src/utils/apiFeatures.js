class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'keyword'];
    excludedFields.forEach(el => delete queryObj[el]);

    // Advanced filtering: salary, etc. (gt, gte, lt, lte)
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    
    let parsedQuery = JSON.parse(queryStr);

    // Handle comma-separated fields (Array/Multi-select)
    // Handle comma-separated fields (Array/Multi-select)
    ['location', 'type', 'experienceLevel', 'title'].forEach(field => {
        if (parsedQuery[field] && typeof parsedQuery[field] === 'string' && parsedQuery[field].includes(',')) {
            const values = parsedQuery[field].split(',');
            
            if (field === 'location' || field === 'title') {
                 // Substring match (User request: %typed% includes)
                 parsedQuery[field] = { $in: values.map(val => new RegExp(val.trim(), 'i')) };
            } else {
                 // Exact match (case-insensitive) for Enums
                 parsedQuery[field] = { $in: values.map(val => new RegExp(`^${val.trim()}$`, 'i')) };
            }

        } else if (parsedQuery[field] && typeof parsedQuery[field] === 'string') {
            // Single value
            if (field === 'location' || field === 'title') {
                 parsedQuery[field] = { $regex: parsedQuery[field].trim(), $options: 'i' };
            } else {
                 parsedQuery[field] = { $regex: `^${parsedQuery[field].trim()}$`, $options: 'i' };
            }
        }
    });

    // Handle Salary Range (minSalary / maxSalary)
    // Front sends: minSalary=25000, maxSalary=100000
    // Logic: Job overlap or fitting?
    // User wants jobs that pay WITHIN this range or AT LEAST X?
    // Let's go with: Job's salary range MUST overlap with user's requested range.
    // Overlap formula: (JobMin <= UserMax) && (JobMax >= UserMin)
    // BUT we are using simple query params for now.
    // If User sends minSalary & maxSalary:
    // We want jobs where:
    // (job.minSalary >= user.minSalary) AND (job.maxSalary <= user.maxSalary)? No that's too strict (subset).
    
    // Let's implement robust Overlap logic if both are present.
    // User Range: [uMin, uMax]
    // Job Range: [jMin, jMax]
    // Overlap: jMin <= uMax AND jMax >= uMin
    
    // However, existing simple APIFeatures pattern is direct mapping.
    // Let's support standard gt/lt query params first. 
    // If custom logic is needed, we handle it explicitly.
    
    // Handle Salary Range Overlap Logic
    if (parsedQuery.minSalary || parsedQuery.maxSalary) {
         const userMin = Number(parsedQuery.minSalary) || 0;
         const userMax = Number(parsedQuery.maxSalary) || Number.MAX_SAFE_INTEGER;
         
         // Remove direct minSalary/maxSalary match if they exist in parsedQuery
         // because we want logic, not exact match
         delete parsedQuery.minSalary;
         delete parsedQuery.maxSalary;

         // Overlap Formula: (JobMin <= UserMax) AND (JobMax >= UserMin)
         parsedQuery.$and = [
             { minSalary: { $lte: userMax } },
             { maxSalary: { $gte: userMin } }
         ];
    }

    this.query = this.query.find(parsedQuery);

    return this;
  }

  search(fields = ['title', 'description']) {
    if (this.queryString.keyword) {
      const keywordRegex = {
          $regex: this.queryString.keyword,
          $options: 'i'
      };
      
      const keywordQuery = {
        $or: fields.map(field => ({ [field]: keywordRegex }))
      };
      
      this.query = this.query.find(keywordQuery);
    }
    return this;
  }
  
  // Specific Text Search using Mongo Text Index
  textSearch() {
     if (this.queryString.search) {
         this.query = this.query.find({ $text: { $search: this.queryString.search } });
     }
     return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
