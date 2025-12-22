import * as cheerio from 'cheerio';

//Get titles and subtitles
export function processTitle(title: string) {

// Predefined lists
  const TYPES = [
    "Anklets","Armlet","Bangles","Bracelet"
  ];

  const TYPE_KEYWORDS = {
  "Waist Band": ["waist", "band", "belt", "waistband", "waistbelt","Kamar"],
  "Necklaces" : ["Pendants","Pendant","Necklace","Choker","Mangalsutra"],
  "Hair Accessories" : ["Damini","Tikka"],
  "Earrings": ["Jhumkas","Jhumki","Studs","Drop","Chandbalis","Hoop","Earrings"],
  "Nose Ring":["Nose"],
  "Ring" : ["Finger","Ring"],
  "Nose Pin" : ["Pin"],
   "Bridal Set"  : ["Bridal"],
    "Watch Charms": ["Charms"]  
};

  const SUBTYPES = [
    "Beads","Chandbali","Charm","Hasli","Jhumka","Mangalsutra","Pendant","rakhi"
    ]

  const SUBTYPE_KEYWORD = {
    "Accessories": ["Anklets","Armlet","Ring"],
    "Hair Accessories": ["Tikka","Damini"],
    "Bracelet Cuffs" : ["Cuff"],
    "Chokers" : ["Choker"],
    "Ear Cuffs" : ["Cuffs"],
    "Drop Earrings" : ["Drop"],
    "Layered Necklace" : ["Layered"],
    "Long Necklace": ["Long"],
    "Short Necklace": ["Short"],
    "Hoops" : ["Hoop"],
    "Studs" : ["Studs","Stud"],
    "Chain Bracelet": ["Chain"]
  }

  const words = title.split(" ");
  let type = "";
  const subtypes :string[] = []; // Multiple subtypes allowed

  // 1. FIND TYPE 
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    
    // Keyword types
    if (!type) {
      for (const [mainType, keywords] of Object.entries(TYPE_KEYWORDS)) {
        if (keywords.some(keyword => keyword.toLowerCase() === lowerWord)) {
          type = mainType;
          break;
        }
      }
    }
    
    // Simple types
    if (!type) {
      const exactMatch = TYPES.find(t => t.toLowerCase() === lowerWord);
      if (exactMatch) type = exactMatch;
    }
  }

  // 2. FIND ALL SUBTYPES (multiple matches)
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    
    // Check subtype keywords
    for (const [subtype, keywords] of Object.entries(SUBTYPE_KEYWORD)) {
      if (keywords.some(keyword => keyword.toLowerCase() === lowerWord)) {
        if (!subtypes.includes(subtype)) {
          subtypes.push(subtype);
        }
      }
    }
    
    // Check simple subtypes (exact match)
    const exactSubtype = SUBTYPES.find(st => st.toLowerCase() === lowerWord);
    if (exactSubtype && !subtypes.includes(exactSubtype)) {
      subtypes.push(exactSubtype);
    }
  }

  return { 
    type: type || "", 
    subtypes: subtypes  // Array of multiple subtype strings
  };

}

// Replace content between <Description> tags with new content
export function replaceDescription(html: string, newContent: string): string {
  if (!html) return html;
  
  // Find and replace content between <Description> and </Description> tags (case-insensitive)
  const descriptionRegex = /(<Description[^>]*>)([\s\S]*?)(<\/Description>)/i;
  
  if (html.match(descriptionRegex)) {
    // Replace the content between the tags, keeping the tags themselves
    return html.replace(descriptionRegex, `$1${newContent}$3`);
  }
    // If no Description tags found, return original HTML unchanged
  return html;
}

export async function fetchFirstProductDescription(filterUrl: string) {
  try {
    // 1. Fetch the filtered collection page
    const collectionResponse = await fetch(filterUrl);
    const collectionHtml = await collectionResponse.text();
    const $ = cheerio.load(collectionHtml);
    
    // 2. Find the first product link
    // Common selectors (adjust for your site):
    const firstProductLink = $('a[href*="/products/"]').first().attr('href');
    // OR: $('.product-card a').first().attr('href');
    // OR: $('[data-product-handle]').first().attr('data-product-handle');
    
    if (!firstProductLink) {
      return 'No products found';
    }
    
    // 3. Construct full product URL
    const productUrl = firstProductLink.startsWith('http') 
      ? firstProductLink 
      : `https://paksha.com${firstProductLink}`;
    
    // 4. Fetch the product page
    const productResponse = await fetch(productUrl);
    const productHtml = await productResponse.text();
    const $$ = cheerio.load(productHtml);
    
    // 5. Extract description
    // Common description locations:
    const description = 
      $$('.product-description').text().trim() ||
      $$('[data-product-description]').text().trim() ||
      $$('meta[property="og:description"]').attr('content') ||
      'No description found';
    
    return description;
    
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return 'Description unavailable';
  }
}

export async function getContent(MainCollection:string,type:string, console: any, env: any) {
  
  if (MainCollection === "Irya") {
    MainCollection = "Irya Collection";
  }
  MainCollection = MainCollection.trim()? MainCollection.replace(/\s+/g, '+'): MainCollection;
  const filterUrl = `https://paksha.com/collections/${MainCollection}?filter.p.m.custom.product_types=${type}`;
  const description = await fetchFirstProductDescription(filterUrl);
  return description;

}

export function isHomogeneous(csvData: string[][], console: Console, env: any): boolean {
  // Check if we have at least 2 products (1 header + 2+ rows)
  if (csvData.length <= 2) {
    return true; // Single product or empty is trivially homogeneous
  }
  
  const headers = csvData[0];
  const typeIndex = headers.indexOf("Type");
  const collectionsIndex = headers.indexOf("Collections");
  
  // If required columns don't exist
  if (typeIndex === -1 || collectionsIndex === -1) {
    return false; // Can't determine homogeneity
  }
  
  let firstType: string | null = null;
  let firstCollection: string | null = null;
  
  // Start from row 1 (skip header)
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    const currentType = row[typeIndex]?.trim();
    const currentCollections = row[collectionsIndex]?.trim();
    
    // Extract first collection (before comma if multiple)
    const firstCurrentCollection = currentCollections?.split(',')[0]?.trim();
    
    if (i === 1) {
      // First product - set reference values
      firstType = currentType;
      firstCollection = firstCurrentCollection;
    } else {
      // Compare with first product
      if (currentType !== firstType || firstCurrentCollection !== firstCollection) {
        return false;
      }
    }
  }
  
  return true; // All products matched
}

export function jsonTo2DArray(jsonData: Record<string, string>[]): string[][] {
  if (!Array.isArray(jsonData) || jsonData.length === 0) return [];

  // Collect union of numeric-string keys across all rows
  const keySet = new Set<number>();
  for (const obj of jsonData) {
    for (const k of Object.keys(obj)) {
      const n = Number(k);
      if (!Number.isNaN(n)) keySet.add(n);
    }
  }

  // If no numeric keys found, return empty
  if (keySet.size === 0) return [];

  const indices = Array.from(keySet).sort((a, b) => a - b);

  // Build rows: for each object, place value at position matching numeric key index
  return jsonData.map(obj =>
    indices.map(idx => {
      const v = obj[String(idx)];
      return v == null ? "" : String(v).trim();
    })
  );
}

 
export async function processData(sku: string, sheetData: string [][], env: any, ctx: any) 
{

//adding title & seo
const title = sheetData.find(row => row[7] === sku)?.[9] ?? "Not found";
const seotitle = `Discover ${title} | Paksha`;

//adding type
const Type = String(processTitle(title).type || "").trim();

//getting subtype array
const subtypes = processTitle(title).subtypes;

//adding default date tag
const currentMonthYear = new Date().toLocaleString('default', { 
  month: 'long', 
  year: 'numeric' 
});
 
  //adding collection
const DEFAULT_COLLECTIONS = ["New arrivals", currentMonthYear];

const MainCollection = sheetData.find(row => row[7] === sku)?.[8] ?? "Not found";
const MainSubCollection: string[] = [Type, ...subtypes].map(
  variant => `${MainCollection} - ${variant}`
);
const conditionalCollection = subtypes.includes("Accessories") ? "Accessories" :
                              subtypes.includes("Hair Accessories") ? "Hair Accessories" : "";
const isFlag = subtypes.includes("Accessories") || subtypes.includes("Hair Accessories") ? 1 : 0;
const prefix = "Silver ";
let silverCollection: string = "";

if (Type === "Bangles" || Type === "Bracelet") {
  silverCollection = "Silver Bangles and Bracelets";
} else if (subtypes.includes("Jhumka")) {
  silverCollection = "Silver Jhumki Earrings";
} else if (subtypes.includes("Mangalsutra")) {
  silverCollection = "Silver Mangalsutra Collection";
} else if (Type === "Necklaces") {
  silverCollection = "Silver Necklace Set";
} else {
  silverCollection =
    conditionalCollection !== ""
      ? prefix + conditionalCollection
      : prefix + Type;
}
const silverSubcollections = subtypes.map(item => prefix+item);

let allCollections: string[];
//adding all the collections
  if (isFlag === 1) {
 allCollections = [MainCollection,...MainSubCollection,silverCollection,...silverSubcollections];
  } else {
    allCollections = [MainCollection,...MainSubCollection,silverCollection,...silverSubcollections,conditionalCollection];
  }
const totalCollections = [...allCollections,...DEFAULT_COLLECTIONS];
  
// adding tags
const stoneColor = sheetData.find(row => row[7] === sku)?.[5] ?? null;
const plating    = sheetData.find(row => row[7] === sku)?.[6] ??  null;
const Tags = ["NEW",Type,...subtypes,stoneColor,plating];
const allTags = Tags.filter(Boolean) as string[];

//adding description
const Bodyhtml = await getContent(MainCollection,Type,env,ctx);
console.info({ 
  sku, 
  BodyhtmlLength: Bodyhtml?.length || 0, 
  BodyhtmlPreview: Bodyhtml?.substring(0, 100) || "empty" 
}, "DEBUG: Bodyhtml from getContent");

const description = sheetData.find(row => row[7] === sku)?.[10] ?? "Not found";
console.info({ 
  sku, 
  description, 
  descriptionLength: description?.length || 0 
}, "DEBUG: Description from sheet");
let content = replaceDescription(Bodyhtml,description);
  if (content === "") {
    content = description;
  }
console.info({ 
  sku, 
  contentLength: content?.length || 0, 
  contentPreview: content?.substring(0, 100) || "empty",
  contentIsSameAsBodyhtml: content === Bodyhtml,
  contentIsSameAsDescription: content === description
}, "DEBUG: Final content after replaceDescription");
const finalProductType = (Type === "Ring") ? "Finger Ring" : Type;

  return {
    collections: totalCollections,
    title: title,
    tags: Array.from(allTags),
    content: content,
    productType: finalProductType,
    seotitle: seotitle
  };
}

export async function GetGoogleData(env:any) {
    const columnLetter = (index: number): string => {
    let letter = "";
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };
  type SheetData = Record<string, string>;

  // Convert 2D array (rows) -> JSON with A,B,C... keys
  const rowsToColumnJSON = (rows: string[][]): SheetData[] => {
    if (!rows || rows.length <= 1) return [];

    // remove header row
    const dataRows = rows.slice(1);

    // determine max columns based on all rows (including header) to keep column count consistent
    const maxCols = Math.max(...rows.map((r) => r.length));
    const columnKeys = Array.from({ length: maxCols }, (_, i) => i.toString());
    return dataRows.map((row) => {
      const obj: SheetData = {};
      columnKeys.forEach((col, i) => {
        obj[col] = row[i]?.toString().trim() ?? "";
      });
      return obj;
    });
  };
  

  try {
    const sheetId = "1_oYBuWmhp36lRGtkDGzuTgxgS8OeST9QAI2hEXYiL4I";
    const range = "Sheet1!A:Z";

    if (!sheetId) {
      return {
        success: false,
        message: " Sheet ID is required",
        data: null,
      };
    }

  
    const apiKey = env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) {
      console.error("Google Sheets API key not configured");
      return {
        success: false,
        message: "Google Sheets integration not configured",
        data: null,
      };
    }

    // Fetch data
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { values?: string[][] };
    const rows = data.values || [];

    //  Convert rows → JSON with alphabet keys
    const alphabetJSON = rowsToColumnJSON(rows);

    return {
      data: alphabetJSON,
    };
  } catch (error) {
    console.error({ error }, "Failed to fetch data from Google Sheets");
    return {
      message: error instanceof Error ? error.message : "Unknown error fetching sheet data",
      data: null,
    };
  }
}


//Main function 
export async function generateData(skus: string[],sheetJSON: Record<string, string>[], console: any, env: any) {
  const sheetData = jsonTo2DArray(sheetJSON);

  console.info({
  sheetDataExists: !!sheetData,
  sheetDataLength: sheetData?.length || 0,
  firstRowSample: sheetData?.[0] || null,
  skuListProvided: skus
        }, "DEBUG: Data state before processing");
  console.info({ rowCount: sheetData.length }, "Successfully fetched sheet data");
    const headers = [
    "Title", "Body HTML", "Vendor", "Type", 
    "Tags", "Status", "Custom Collections", "SEO Title"
  ];

  // 2. 2D array with headers as first row
  const csvData: string[][] = [headers];
  
    for (const [index, sku] of skus.entries()) {
    try {    
      // Generate data for this SKU
      const skuData = await processData(sku,sheetData, env, null);
      
      const row: string[] = [
        //  required fields
        skuData.title,
        skuData.content,
        "SILVER",
        skuData.productType,
        skuData.tags.join(","),
        "Draft", 
        skuData.collections.join(",") ,
        skuData.seotitle,
      ];
      csvData.push(row);
      }
       catch (error) {
      console.error({ error, sku }, "Failed to process SKU");
    }

  }
  
  const csv = csvData.map(row => row.join(',')).join('\n');

// Check homogeneity

  const homogeneous = isHomogeneous(csvData, console, env); 
  return { 
  csv : csv,
  homogeneous: homogeneous  // true if all same collections, false if mixed
  };
}