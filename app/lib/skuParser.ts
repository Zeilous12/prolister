import { parseHTML } from 'linkedom';

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

/* ----------------------------------
----------------------------------- */
export function replaceDescription(html: string, newContent: string): string {
  if (!html) return html;

  const descriptionRegex =
    /(<Description[^>]*>)([\s\S]*?)(<\/Description>)/i;

  if (html.match(descriptionRegex)) {
    return html.replace(descriptionRegex, `$1${newContent}$3`);
  }
  return html;
}

/* ----------------------------------
   LINKEDOM VERSION (Worker-safe)
----------------------------------- */
export async function fetchFirstProductDetailsHTML(
  filterUrl: string,
  fallbackUrl: string
): Promise<string> {
  try {
    /* -------------------------
       1. Fetch collection page
    -------------------------- */
    let collectionHtml: string | null = null;
    let baseUrl = filterUrl;

    const filterRes = await fetch(filterUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
    }
  });
    if (filterRes.ok) {
      collectionHtml = await filterRes.text();
    } else {
      const fallbackRes = await fetch(fallbackUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
    }
  });
      if (!fallbackRes.ok) {
        return `The filter URL is ${filterUrl} and the fallback URL is ${fallbackUrl}`;
      }
      collectionHtml = await fallbackRes.text();
      baseUrl = fallbackUrl;
    }

    const { document: collectionDoc } = parseHTML(collectionHtml);

    /* -------------------------
       2. Find first product link
    -------------------------- */
    const productAnchor = collectionDoc.querySelector(
      'a[href*="/products/"]'
    ) as HTMLAnchorElement | null;

    if (!productAnchor?.getAttribute('href')) {
      return 'No products found in this filter';
    }

    /* -------------------------
       3. Normalize product URL
    -------------------------- */
    const href = productAnchor.getAttribute('href')!;
    const productUrl = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();

    /* -------------------------
       4. Fetch product page
    -------------------------- */
    const productRes = await fetch(productUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
    }
  });
    if (!productRes.ok) return 'Failed to fetch product page';

    const productHtml = await productRes.text();
    const { document: productDoc } = parseHTML(productHtml);

    /* -------------------------
       5. Extract Product Details
    -------------------------- */
    const tabs = productDoc.querySelectorAll('details.collapsible-tab');

    for (const tab of tabs) {
      const heading = tab
        .querySelector('summary span')
        ?.textContent?.trim();

      if (heading === 'Product Details') {
        const content = tab.querySelector(
          '.collapsible-tab__text'
        ) as HTMLElement | null;

        if (!content) return 'Product details not found';

        // Remove hidden junk
        content
          .querySelectorAll('[style*="display: none"]')
          .forEach(el => el.remove());

        return content.innerHTML.trim();
      }
    }

    return 'Product details section not found';
  } catch (error) {
    console.error('Failed to fetch first product details:', error);
    return 'Description unavailable';
  }
}

export async function getContent(MainCollection:string,type:string) {

  MainCollection = MainCollection.toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')  // Remove special characters
    .replace(/^-+|-+$/g, '');
  
  if (MainCollection === "irya") {
    MainCollection = "irya-collection";
  } else if (MainCollection === "tyarra") {
    MainCollection = "tyarra-collection";
  } else if (MainCollection === "nakshatra") {
    MainCollection = "nakshatra-collection";
  } else if (MainCollection === "mangalsutra") {
    MainCollection = "mangalsutra-collection";
  }
    type = type.trim()
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')  // Remove special characters
    .replace(/^-+|-+$/g, '');

    if (type === "Bangles") {
      type = "Bangle";
    } else if (type === "Necklaces") {
      type = "Necklace";
    } else if (type === "Anklets") {
      type = "Anklet";
    } else if (type === "Watch Charms") {
      type = "Watch Charm";
    } 
    const weburl = `https://paksha.com/`;
    const mainurl = `https://paksha.com/collections/${MainCollection}`; 
  const filterUrl = `https://paksha.com/collections/${MainCollection}?filter.p.m.custom.product_types=${type}`;

    let description = "";
    if (type === "Hair Accessories" || type === "Bridal Set" || type === "Nose Pin" || type === "Waist Band" || type === "Armlet" || type === "Nose Ring" || type === "Nose Pin") {
        description = await fetchFirstProductDetailsHTML(mainurl,weburl);
      }
    else {
      description = await fetchFirstProductDetailsHTML(filterUrl,mainurl);
    }
    
    return description;
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
const webhtml = await getContent(MainCollection,Type) || "No description available";
const sheetcontent = sheetData.find(row => row[7] === sku)?.[10] || "";
const Bodyhtml = replaceDescription(webhtml, sheetcontent);
console.info({
  sku, 
  BodyhtmlLength: Bodyhtml?.length || 0, 
  BodyhtmlPreview: Bodyhtml?.substring(0, 100) || "empty" 
}, "DEBUG: Bodyhtml from getContent");

const finalProductType = (Type === "Ring") ? "Finger Ring" : Type;

  return {
    collections: totalCollections,
    title: title,
    tags: Array.from(allTags),
    content: Bodyhtml,
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
export async function generateData(skus: string[],sheetJSON: Record<string, string>[], env: any) {
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
  
  const csv = csvData.map(row => row.join(';')).join('\n');

// Check homogeneity

  return { 
  csv : csv,
  };
}
