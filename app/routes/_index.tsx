
import { useState } from "react";
// ... code...
import { action as parseAction } from '~/api/parseSKU.server';

export const action = async ({ request, context }: any) => {
  return parseAction({ request, context });
};
// ... code...

interface ApiResponse {
  data?: {
    success: boolean;
  };
}

export default function Home() {
  // Simplified states
  const [sku, setSku] = useState("");
  const [processStage, setProcessStage] = useState<'initial' | 'processing' | 'ready' | 'completed'>('initial');
  const [detectedType, setDetectedType] = useState<'single' | 'multiple' | ''>('');
  const [csvBlob, setCsvBlob] = useState<Blob | null>(null);
  const [showForm, setShowForm] = useState(false);

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
  const generateCSV = async (skuInput: string, detectedType: 'single' | 'multiple'): Promise<ApiResponse & { csvBlob?: Blob }> => {
    try {
      console.log('Calling API:', 'api/parseSKU');

      const response = await fetch('api/parseSKU', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: skuInput })
      });
      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Get CSV as blob for download
      const blob = await response.blob();
      setCsvBlob(blob);
      
      return {
        data: {
          success: true
        },
        csvBlob: blob
      };
      
    } catch (error) {
      console.error('CSV generation error:', error);
      return {
        data: {
          success: false
        }
      };
    }
  };

  // Download CSV handler
  const downloadCSV = () => {
    if (!csvBlob) return;
    
    const url = window.URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matrixify-import.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    setProcessStage('completed');
  };

  // Process SKU handler
  const handleSkuSubmit = async () => {
    const skuInput = sku.trim();
    
    if (!skuInput) return;
    
    // Detect type
    const type: 'single' | 'multiple' = skuInput.length <= 14 ? 'single' : 'multiple';
    setDetectedType(type);
    
    setProcessStage('processing');
    
    try {
      const result = await generateCSV(skuInput, type);
      
      if (result.data?.success) {
        setProcessStage('ready'); // Ready for download
      } else {
        setProcessStage('initial');
      }
    } catch (error) {
      console.error('Error processing SKU:', error);
      setProcessStage('initial');
    }
  };

  const toggleForm = () => setShowForm(!showForm);
  const handleReset = () => {
    setProcessStage('initial');
    setSku("");
    setCsvBlob(null);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Product Listing</h1>

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
                    Automate Product Listing
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
                      Learn more
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
                    SKU
                  </label>
                  <textarea
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Enter SKU or multiple SKUs"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
                <button
                  onClick={handleSkuSubmit}
                  className="px-4 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-blue-700 transition"
                >
                  Generate CSV
                </button>
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
                  CSV Generated Successfully!
                </h3>
                <p className="text-gray-600">
                  Your CSV file is ready for download.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={downloadCSV}
                    className="px-4 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-blue-700 transition"
                  >
                    Download CSV
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

        {/* Completed State */}
        {processStage === 'completed' && (
          <Section>
            <Card className="p-6">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  CSV Downloaded Successfully!
                </h3>
                <p className="text-gray-600">
                  Your Matrixify import file is ready.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-blue-700 transition"
                  >
                    Process More SKUs
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
