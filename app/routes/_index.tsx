import { useState } from "react";
import * as XLSX from "xlsx";
import type { MetaFunction } from "@remix-run/cloudflare";
export const meta: MetaFunction = () => {
  return [
    { title: "SKU Parser - Shopify CSV Generator" },
    { name: "description", content: "Generate Shopify CSV from SKUs" },
  ];
};


interface ApiResponse {
  data?: {
    success: boolean;
  };
}

export default function Home() {
  const [sku, setSku] = useState("");
  const [processStage, setProcessStage] = useState<'initial' | 'processing' | 'ready' | 'completed'>('initial');
  const [detectedType, setDetectedType] = useState<'single' | 'multiple' | ''>('');
  const [csvBlob, setCsvBlob] = useState<Blob | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI Helper Components
  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  );

  const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`mb-6 ${className}`}>{children}</div>
  );

  const Spinner = () => (
    <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
  // POST hook for CSV generation 
  const generateCSV = async (skuInput: string, detectedType: 'single' | 'multiple'): Promise<{ success: boolean; csvBlob?: Blob }> => {
    try {
      console.log('Calling API:', '/api/parseSKU');
      setError(null);

      // Use JSON payload
      const response = await fetch('/api/parseSKU', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sku: skuInput,
          type: detectedType 
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      // Check if response is CSV
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/csv')) {
        const blob = await response.blob();
        setCsvBlob(blob);
        return { success: true, csvBlob: blob };
      } else {
        // Handle JSON error response
        const errorData = await response.json();
        throw new Error('Invalid response format');
      }
      
    } catch (error) {
      console.error('CSV generation error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      return { success: false };
    }
  };

  // Download CSV handler
  const downloadCSV = () => {
    if (!csvBlob) return;
    
    const url = window.URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Shopify-import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    setProcessStage('ready');
  };
  // Download XLSX handler
const downloadXLSX = async () => {
  if (!csvBlob) return;

  const csvText = await csvBlob.text();

  // Read CSV
  const workbook = XLSX.read(csvText, { type: "string" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Rename second column header
  if (worksheet["B1"]) {
    worksheet["B1"].v = "Body HTML";
  }


  // Export XLSX
  const xlsxArrayBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array"
  });

  const xlsxBlob = new Blob(
    [xlsxArrayBuffer],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );

  // Download
  const url = URL.createObjectURL(xlsxBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "matrixify-import.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setProcessStage("ready");
};


  // Process SKU handler
  const handleSkuSubmit = async () => {
    const skuInput = sku.trim();
    
    if (!skuInput) {
      setError("Please enter at least one SKU");
      return;
    }
    
    // Detect type
    const type: 'single' | 'multiple' = skuInput.includes('\n') || skuInput.includes(',') ? 'multiple' : 'single';
    setDetectedType(type);
    
    setProcessStage('processing');
    
    try {
      const result = await generateCSV(skuInput, type);
      
      if (result.success) {
        setProcessStage('ready'); // Ready for download
      } else {
        setProcessStage('initial');
      }
    } catch (error) {
      console.error('Error processing SKU:', error);
      setProcessStage('initial');
    }
  };

  const toggleForm = () => {
    setShowForm(!showForm);
    setError(null);
  };

  const handleReset = () => {
    setProcessStage('initial');
    setSku("");
    setCsvBlob(null);
    setShowForm(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Product Listing</h1>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Initial State */}
        {processStage === 'initial' && !showForm && (
          <Section>
            <Card className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
                <img 
                  src="/Flower.png" 
                  alt="Tarinika Icon"
                  className="w-40 h-30 object-contain rounded-lg"
                />
                <div className="text-left flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
                    Your Product Listing Assistant
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                    <button
                      onClick={toggleForm}
                      className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                    >
                      Upload SKU
                    </button>
                    <a 
                      href="https://www.linkedin.com/in/zubair-baig60/"
                      className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-center"
                    >
                      About
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </Section>
        )}

        {/* SKU Input Form */}
        {processStage === 'initial' && showForm && (
          <Section>
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter SKU(s)
                  </label>
                  <textarea
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter one SKU per line or separate with commas"
                    className="w-full px-3 py-2 border border-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={5}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Supports direct paste from Excel
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSkuSubmit}
                    className="px-4 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-blue-700 transition"
                  >
                    Generate data
                  </button>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          </Section>
        )}

        {/* Processing State */}
        {processStage === 'processing' && (
          <Section>
            <Card className="p-8">
              <div className="text-center space-y-4">
                <Spinner />
                <p className="text-gray-900">
                  Processing {detectedType === 'single' ? 'single SKU' : 'multiple SKUs'}
                </p>
                <p className="text-sm text-gray-500">
                  This may take a moment
                </p>
              </div>
            </Card>
          </Section>
        )}

        {/* Ready State (CSV Generated) */}
        {processStage === 'ready' && (
          <Section>
            <Card className="p-6">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Data Generated Successfully
                </h3>
                <p className="text-gray-600">
                  Your file is ready for download.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={downloadCSV}
                    className="px-4 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-blue-700 transition"
                  >
                    Shopify import
                  </button>
                  <button
                    onClick={downloadXLSX}
                    className="px-4 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-blue-700 transition"
                  >
                    matrixify import
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            </Card>
          </Section>
        )}
      </div>
    </div>
  );
}