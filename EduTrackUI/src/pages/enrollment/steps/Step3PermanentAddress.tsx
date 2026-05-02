import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { EnrollmentFormData } from "../EnrollmentForm";

interface Step3Props {
  formData: EnrollmentFormData;
  updateFormData: (updates: Partial<EnrollmentFormData>) => void;
  errors: Record<string, string>;
  isReturningStudent?: boolean;
  isFirstTimer?: boolean;
}

interface Region {
  code: string;
  name: string;
}

interface Province {
  code: string;
  name: string;
  regionCode?: string;
}

interface CityMunicipality {
  code: string;
  name: string;
}

interface Barangay {
  code: string;
  name: string;
}

const PSGC_API = "https://psgc.gitlab.io/api";

const Step3PermanentAddress = ({ formData, updateFormData, errors, isReturningStudent = false, isFirstTimer = true }: Step3Props) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<CityMunicipality[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  
  // Autocomplete state
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showMunicipalityDropdown, setShowMunicipalityDropdown] = useState(false);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  
  const [filteredProvinces, setFilteredProvinces] = useState<Province[]>([]);
  const [filteredMunicipalities, setFilteredMunicipalities] = useState<CityMunicipality[]>([]);
  const [filteredBarangays, setFilteredBarangays] = useState<Barangay[]>([]);
  const [filteredRegions, setFilteredRegions] = useState<Region[]>([]);
  const [currentRegion, setCurrentRegion] = useState<string>("");
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("");

  // Tour State
  const [runMainTour, setRunMainTour] = useState(false);
  const [runAddressTour, setRunAddressTour] = useState(false);

  const sanitizeNumericInput = (value: string, maxLength?: number) => {
    const digits = value.replace(/\D/g, "");
    return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
  };

  const mainTourSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">Permanent Address 🏡</h3>
          <p>If different from current address, provide the permanent home address.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#same-as-current-checkbox',
      content: 'Check this box if the permanent address is the same as the current address. If different, uncheck this box to enter a new address.',
    },
  ];

  const addressTourSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-center">
          <h3 className="font-bold text-lg mb-2">Great! Now you can enter the permanent address details below. 📝</h3>
          <p>Fill in each field to complete your permanent address information.</p>
        </div>
      ),
      placement: 'center' as const,
    },
    {
      target: '#permanentRegion',
      content: 'Type the Region name so the Province suggestions become available.',
    },
    {
      target: '#permanentAddress',
      content: 'Enter the House No., Street Name, or Purok.',
    },
    {
      target: '#permanentProvince',
      content: 'Type the Province name. Select from suggestions to unlock City/Municipality.',
    },
    {
      target: '#permanentMunicipality',
      content: 'Type the City or Municipality. Select from suggestions to unlock Barangay.',
    },
    {
      target: '#permanentBarangay',
      content: 'Type the Barangay. Select from suggestions.',
    }
  ];

  useEffect(() => {
    // Auto start main tour for step 3
    const hasSeenTour = localStorage.getItem('hasSeenPermanentAddressTour');
    if (!hasSeenTour) {
      setRunMainTour(true);
    }
  }, []);

  const handleMainTourCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunMainTour(false);
      localStorage.setItem('permanentAddressTourCompleted', 'true');
      
      // If checkbox is unchecked, start the address tour
      if (!formData.same_as_current) {
        setTimeout(() => setRunAddressTour(true), 500);
      }
    }
  };

  const handleAddressTourCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunAddressTour(false);
    }
  };

  // Fetch regions on component mount
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch(`${PSGC_API}/regions.json`);
        const data = await response.json();
        setRegions(data);
      } catch (error) {
        console.error("Error fetching regions:", error);
      }
    };

    fetchRegions();
  }, []);

  // Fetch provinces when region is selected
  useEffect(() => {
    if (!selectedRegionCode) {
      setProvinces([]);
      setFilteredProvinces([]);
      return;
    }

    const fetchProvinces = async () => {
      try {
        const response = await fetch(`${PSGC_API}/regions/${selectedRegionCode}/provinces.json`);
        const data = await response.json();
        setProvinces(data);
        setFilteredProvinces(data);
      } catch (error) {
        console.error("Error fetching provinces:", error);
      }
    };

    fetchProvinces();
  }, [selectedRegionCode]);

  // Filter and fetch municipalities when province changes
  useEffect(() => {
    if (!formData.permanent_province) {
      setFilteredMunicipalities([]);
      setMunicipalities([]);
      return;
    }

    const fetchMunicipalities = async () => {
      try {
        const province = provinces.find(p => p.name.toLowerCase().includes(formData.permanent_province.toLowerCase()));
        if (!province) return;

        const response = await fetch(
          `${PSGC_API}/provinces/${province.code}/cities-municipalities.json`
        );
        const data = await response.json();
        setMunicipalities(data);
        setFilteredMunicipalities(data);
      } catch (error) {
        console.error("Error fetching municipalities:", error);
      }
    };

    fetchMunicipalities();
  }, [formData.permanent_province, provinces]);

  // Filter and fetch barangays when municipality changes
  useEffect(() => {
    if (!formData.permanent_municipality || !municipalities.length) {
      setFilteredBarangays([]);
      setBarangays([]);
      return;
    }

    const fetchBarangays = async () => {
      try {
        const municipality = municipalities.find(m => m.name.toLowerCase().includes(formData.permanent_municipality.toLowerCase()));
        if (!municipality) return;

        const response = await fetch(
          `${PSGC_API}/cities-municipalities/${municipality.code}/barangays.json`
        );
        const data = await response.json();
        setBarangays(data);
        setFilteredBarangays(data);
      } catch (error) {
        console.error("Error fetching barangays:", error);
      }
    };

    fetchBarangays();
  }, [formData.permanent_municipality, municipalities]);

  // Handle municipality search
  const handleMunicipalityChange = (value: string) => {
    updateFormData({ permanent_municipality: value });
    if (value.length > 0) {
      const filtered = municipalities.filter(m => 
        m.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredMunicipalities(filtered);
      setShowMunicipalityDropdown(true);
    } else {
      setShowMunicipalityDropdown(false);
    }
  };

  // Handle barangay search
  const handleBarangayChange = (value: string) => {
    updateFormData({ permanent_barangay: value });
    if (value.length > 0) {
      const filtered = barangays.filter(b => 
        b.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredBarangays(filtered);
      setShowBarangayDropdown(true);
    } else {
      setShowBarangayDropdown(false);
    }
  };

  // Handle region search
  const handleRegionChange = (value: string) => {
    setCurrentRegion(value);
    if (value.length > 0) {
      const filtered = regions.filter(r => 
        r.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredRegions(filtered);
      setShowRegionDropdown(true);
    } else {
      // On clear, show all regions
      setFilteredRegions(regions);
      setShowRegionDropdown(true);
    }
  };

  // Handle region selection (show provinces but don't save region)
  const selectRegion = (region: Region) => {
    setCurrentRegion(region.name);
    setSelectedRegionCode(region.code);
    setShowRegionDropdown(false);
  };

  // Handle province search
  const handleProvinceChange = (value: string) => {
    updateFormData({ permanent_province: value });
    if (value.length > 0) {
      const filtered = provinces.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProvinces(filtered);
      setShowProvinceDropdown(true);
    } else {
      // On clear, show all provinces for selected region
      setFilteredProvinces(provinces);
      setShowProvinceDropdown(true);
    }
  };

  // Handle selection from dropdown
  const selectProvince = (province: Province) => {
    updateFormData({ permanent_province: province.name });
    setShowProvinceDropdown(false);
  };

  const selectMunicipality = (municipality: CityMunicipality) => {
    updateFormData({ permanent_municipality: municipality.name });
    setShowMunicipalityDropdown(false);
  };

  const selectBarangay = (barangay: Barangay) => {
    updateFormData({ permanent_barangay: barangay.name });
    setShowBarangayDropdown(false);
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        If your permanent address (home address) is different from the current address, please provide it below.
      </p>

      {!isFirstTimer && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Your permanent address from your previous enrollment has been pre-filled. Update if it has changed.
          </AlertDescription>
        </Alert>
      )}

      {/* Same as current address checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="same-as-current-checkbox"
          checked={formData.same_as_current}
          onCheckedChange={(checked) => {
            updateFormData({ same_as_current: checked as boolean });
            if (checked) {
              updateFormData({
                permanent_address: formData.current_address,
                permanent_province: formData.current_province,
                permanent_municipality: formData.current_municipality,
                permanent_barangay: formData.current_barangay,
                permanent_zip_code: formData.current_zip_code,
              });
            } else {
              // When unchecked, if main tour is completed, start address tour
              const tourCompleted = localStorage.getItem('permanentAddressTourCompleted');
              if (tourCompleted) {
                setTimeout(() => setRunAddressTour(true), 300);
              }
            }
          }}
        />
        <Label htmlFor="sameAsCurrentAddress" className="text-gray-700 font-semibold cursor-pointer">
          Same as current address
        </Label>
      </div>

      {!formData.same_as_current && (
        <>
          {/* Street Address */}
          <div>
            <Label htmlFor="permanentAddress" className="text-gray-700 font-semibold">
              Street Address *
            </Label>
            <Input
              id="permanentAddress"
              value={formData.permanent_address}
              onChange={(e) => updateFormData({ permanent_address: e.target.value })}
              placeholder="e.g., 456 Oak Avenue"
              className={`mt-2 ${errors.permanent_address ? "border-red-500" : ""}`}
            />
            {errors.permanent_address && <p className="text-red-600 text-sm mt-1">{errors.permanent_address}</p>}
          </div>

          {/* Region - Text input with autocomplete (reference only) */}
          <div>
            <Label htmlFor="permanentRegion" className="text-gray-700 font-semibold">
              Region (Reference Only)
            </Label>
            <div className="relative">
              <Input
                id="permanentRegion"
                value={currentRegion}
                onChange={(e) => handleRegionChange(e.target.value)}
                onFocus={() => {
                  setFilteredRegions(regions);
                  setShowRegionDropdown(true);
                }}
                placeholder="Start typing region name..."
                className="mt-2"
                autoComplete="off"
              />
              {showRegionDropdown && filteredRegions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredRegions.slice(0, 10).map((region) => (
                    <button
                      key={region.code}
                      onClick={() => selectRegion(region)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                    >
                      {region.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Province - Text input with autocomplete */}
          <div>
            <Label htmlFor="permanentProvince" className="text-gray-700 font-semibold">
              Province *
            </Label>
            <div className="relative">
              <Input
                id="permanentProvince"
                value={formData.permanent_province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                onFocus={() => {
                  setFilteredProvinces(provinces);
                  setShowProvinceDropdown(true);
                }}
                placeholder="Start typing province name..."
                className={`mt-2 ${errors.permanent_province ? "border-red-500" : ""}`}
                autoComplete="off"
              />
              {showProvinceDropdown && filteredProvinces.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredProvinces.slice(0, 10).map((province) => (
                    <button
                      key={province.code}
                      onClick={() => selectProvince(province)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                    >
                      {province.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.permanent_province && <p className="text-red-600 text-sm mt-1">{errors.permanent_province}</p>}
          </div>

          {/* Municipality/City - Text input with autocomplete */}
          <div>
            <Label htmlFor="permanentMunicipality" className="text-gray-700 font-semibold">
              Municipality/City *
            </Label>
            <div className="relative">
              <Input
                id="permanentMunicipality"
                value={formData.permanent_municipality}
                onChange={(e) => handleMunicipalityChange(e.target.value)}
                onFocus={() => {
                  setFilteredMunicipalities(municipalities);
                  setShowMunicipalityDropdown(true);
                }}
                placeholder="Start typing municipality name..."
                className={`mt-2 ${errors.permanent_municipality ? "border-red-500" : ""}`}
                autoComplete="off"
                disabled={!formData.permanent_province}
              />
              {showMunicipalityDropdown && filteredMunicipalities.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredMunicipalities.slice(0, 10).map((municipality) => (
                    <button
                      key={municipality.code}
                      onClick={() => selectMunicipality(municipality)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                    >
                      {municipality.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.permanent_municipality && <p className="text-red-600 text-sm mt-1">{errors.permanent_municipality}</p>}
          </div>

          {/* Barangay - Text input with autocomplete */}
          <div>
            <Label htmlFor="permanentBarangay" className="text-gray-700 font-semibold">
              Barangay *
            </Label>
            <div className="relative">
              <Input
                id="permanentBarangay"
                value={formData.permanent_barangay}
                onChange={(e) => handleBarangayChange(e.target.value)}
                onFocus={() => {
                  setFilteredBarangays(barangays);
                  setShowBarangayDropdown(true);
                }}
                placeholder="Start typing barangay name..."
                className={`mt-2 ${errors.permanent_barangay ? "border-red-500" : ""}`}
                autoComplete="off"
                disabled={!formData.permanent_municipality}
              />
              {showBarangayDropdown && filteredBarangays.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredBarangays.slice(0, 10).map((barangay) => (
                    <button
                      key={barangay.code}
                      onClick={() => selectBarangay(barangay)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                    >
                      {barangay.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.permanent_barangay && <p className="text-red-600 text-sm mt-1">{errors.permanent_barangay}</p>}
          </div>

          {/* Zip Code */}
          <div>
            <Label htmlFor="permanentZipCode" className="text-gray-700 font-semibold">
              Zip Code
            </Label>
            <Input
              id="permanentZipCode"
              value={formData.permanent_zip_code}
              onChange={(e) => updateFormData({ permanent_zip_code: sanitizeNumericInput(e.target.value, 4) })}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="e.g., 3000"
              className="mt-2"
            />
          </div>
        </>
      )}

      {/* Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-900 text-sm">
          ℹ️ <strong>Note:</strong> If you don't find your location in the autocomplete, you can still type it manually. This helps us know where your child's home is.
        </p>
      </div>

      <Joyride
        steps={mainTourSteps}
        run={runMainTour}
        continuous
        showProgress
        showSkipButton
        callback={handleMainTourCallback}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 1000,
          },
        }}
        locale={{
          last: 'Finish',
          skip: 'Skip',
        }}
      />

      <Joyride
        steps={addressTourSteps}
        run={runAddressTour}
        continuous
        showProgress
        showSkipButton
        callback={handleAddressTourCallback}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 1000,
          },
        }}
        locale={{
          last: 'Finish',
          skip: 'Skip',
        }}
      />
    </div>
  );
};

export default Step3PermanentAddress;
