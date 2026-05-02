import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { EnrollmentFormData } from "../EnrollmentForm";

interface Step2Props {
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

const addressTourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div className="text-left">
        <h3 className="font-bold text-lg mb-2">Address Information 🏠</h3>
        <p>Please provide the current address where the student lives.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#currentAddress',
    content: 'Enter the House No., Street Name, or Purok.',
  },
  {
    target: '#currentRegion',
    content: 'Type the Region name so the Province suggestions become available.',
  },
  {
    target: '#currentProvince',
    content: 'Type the Province name. Select from suggestions to unlock City/Municipality.',
  },
  {
    target: '#currentMunicipality',
    content: 'Type the City or Municipality. Select from suggestions to unlock Barangay.',
  },
  {
    target: '#currentBarangay',
    content: 'Type the Barangay. Select from suggestions.',
  },
  {
    target: '#currentPhone',
    content: 'Enter a valid mobile number where we can contact you.',
  }
];

const Step2CurrentAddress = ({ formData, updateFormData, errors, isReturningStudent = false, isFirstTimer = true }: Step2Props) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [municipalities, setMunicipalities] = useState<CityMunicipality[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  
  // Autocomplete state
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showMunicipalityDropdown, setShowMunicipalityDropdown] = useState(false);
  const [showBarangayDropdown, setShowBarangayDropdown] = useState(false);
  
  const [filteredRegions, setFilteredRegions] = useState<Region[]>([]);
  const [filteredProvinces, setFilteredProvinces] = useState<Province[]>([]);
  const [filteredMunicipalities, setFilteredMunicipalities] = useState<CityMunicipality[]>([]);
  const [filteredBarangays, setFilteredBarangays] = useState<Barangay[]>([]);
  const [currentRegion, setCurrentRegion] = useState<string>("");
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("");

  // Tour State
  const [runTour, setRunTour] = useState(false);

  const sanitizeNumericInput = (value: string, maxLength?: number) => {
    const digits = value.replace(/\D/g, "");
    return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
  };

  const sanitizePhoneInput = (value: string) => {
    let digits = value.replace(/\D/g, "");
    if (!digits) return "";

    if (!digits.startsWith("0")) {
      digits = `0${digits}`;
    }
    if (digits.length >= 2 && digits[1] !== "9") {
      digits = `09${digits.slice(2)}`;
    }

    return digits.slice(0, 11);
  };

  useEffect(() => {
    // Auto start tour for step 2
    const hasSeenTour = localStorage.getItem('hasSeenAddressTour');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      localStorage.setItem('hasSeenAddressTour', 'true');
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
    if (!formData.current_province) {
      setFilteredMunicipalities([]);
      setMunicipalities([]);
      return;
    }

    const fetchMunicipalities = async () => {
      try {
        const province = provinces.find(p => p.name.toLowerCase().includes(formData.current_province.toLowerCase()));
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
  }, [formData.current_province, provinces]);

  // Filter and fetch barangays when municipality changes
  useEffect(() => {
    if (!formData.current_municipality || !municipalities.length) {
      setFilteredBarangays([]);
      setBarangays([]);
      return;
    }

    const fetchBarangays = async () => {
      try {
        const municipality = municipalities.find(m => m.name.toLowerCase().includes(formData.current_municipality.toLowerCase()));
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
  }, [formData.current_municipality, municipalities]);

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
    updateFormData({ current_province: value });
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

  // Handle municipality search
  const handleMunicipalityChange = (value: string) => {
    updateFormData({ current_municipality: value });
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
    updateFormData({ current_barangay: value });
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

  // Handle selection from dropdown
  const selectProvince = (province: Province) => {
    updateFormData({ current_province: province.name });
    setShowProvinceDropdown(false);
  };

  const selectMunicipality = (municipality: CityMunicipality) => {
    updateFormData({ current_municipality: municipality.name });
    setShowMunicipalityDropdown(false);
  };

  const selectBarangay = (barangay: Barangay) => {
    updateFormData({ current_barangay: barangay.name });
    setShowBarangayDropdown(false);
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-600">Please provide your current address (where your child currently lives).</p>

      {/* Street Address */}
      <div>
        <Label htmlFor="currentAddress" className="text-gray-700 font-semibold">
          Street Address *
        </Label>
        <Input
          id="currentAddress"
          value={formData.current_address}
          onChange={(e) => updateFormData({ current_address: e.target.value })}
          placeholder="e.g., 123 Maple Street"
          className={`mt-2 ${errors.current_address ? "border-red-500" : ""}`}
        />
        {errors.current_address && <p className="text-red-600 text-sm mt-1">{errors.current_address}</p>}
      </div>

      {/* Info alert for pre-filled data */}
      {!isFirstTimer && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Your address from your last enrollment has been pre-filled. Please update if you've moved to a new location.
          </AlertDescription>
        </Alert>
      )}

      {/* Region - Text input with autocomplete (reference only) */}
      <div>
        <Label htmlFor="currentRegion" className="text-gray-700 font-semibold">
          Region (Reference Only)
        </Label>
        <div className="relative">
          <Input
            id="currentRegion"
            value={currentRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            onFocus={() => {
              setFilteredRegions(regions);
              setShowRegionDropdown(true);
            }}
            placeholder="MIMAROPA, CAR, NCR, etc."
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
        <Label htmlFor="currentProvince" className="text-gray-700 font-semibold">
          Province *
        </Label>
        <div className="relative">
          <Input
            id="currentProvince"
            value={formData.current_province}
            onChange={(e) => handleProvinceChange(e.target.value)}
            onFocus={() => {
              setFilteredProvinces(provinces);
              setShowProvinceDropdown(true);
            }}
            placeholder="Start typing province name..."
            className={`mt-2 ${errors.current_province ? "border-red-500" : ""}`}
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
        {errors.current_province && <p className="text-red-600 text-sm mt-1">{errors.current_province}</p>}
      </div>

      {/* Municipality/City - Text input with autocomplete */}
      <div>
        <Label htmlFor="currentMunicipality" className="text-gray-700 font-semibold">
          Municipality/City *
        </Label>
        <div className="relative">
          <Input
            id="currentMunicipality"
            value={formData.current_municipality}
            onChange={(e) => handleMunicipalityChange(e.target.value)}
            onFocus={() => {
              setFilteredMunicipalities(municipalities);
              setShowMunicipalityDropdown(true);
            }}
            placeholder="Start typing municipality name..."
            className={`mt-2 ${errors.current_municipality ? "border-red-500" : ""}`}
            autoComplete="off"
            disabled={!formData.current_province}
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
        {errors.current_municipality && <p className="text-red-600 text-sm mt-1">{errors.current_municipality}</p>}
      </div>

      {/* Barangay - Text input with autocomplete */}
      <div>
        <Label htmlFor="currentBarangay" className="text-gray-700 font-semibold">
          Barangay *
        </Label>
        <div className="relative">
          <Input
            id="currentBarangay"
            value={formData.current_barangay}
            onChange={(e) => handleBarangayChange(e.target.value)}
            onFocus={() => {
              setFilteredBarangays(barangays);
              setShowBarangayDropdown(true);
            }}
            placeholder="Start typing barangay name..."
            className={`mt-2 ${errors.current_barangay ? "border-red-500" : ""}`}
            autoComplete="off"
            disabled={!formData.current_municipality}
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
        {errors.current_barangay && <p className="text-red-600 text-sm mt-1">{errors.current_barangay}</p>}
      </div>

      {/* Zip Code */}
      <div>
        <Label htmlFor="currentZipCode" className="text-gray-700 font-semibold">
          Zip Code
        </Label>
        <Input
          id="currentZipCode"
          value={formData.current_zip_code}
          onChange={(e) => updateFormData({ current_zip_code: sanitizeNumericInput(e.target.value, 4) })}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="e.g., 3000"
          className="mt-2"
        />
      </div>

      {/* Contact Number */}
      <div>
        <Label htmlFor="currentPhone" className="text-gray-700 font-semibold">
          Contact Number *
        </Label>
        <Input
          id="currentPhone"
          type="tel"
          value={formData.current_phone}
          onChange={(e) => {
            updateFormData({ current_phone: sanitizePhoneInput(e.target.value) });
          }}
          inputMode="numeric"
          pattern="09[0-9]{9}"
          maxLength={11}
          placeholder="e.g., 09XXXXXXXXX"
          className={`mt-2 ${errors.current_phone ? "border-red-500" : ""}`}
        />
        {errors.current_phone && <p className="text-red-600 text-sm mt-1">{errors.current_phone}</p>}
      </div>

      <Joyride
        steps={addressTourSteps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
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

export default Step2CurrentAddress;
