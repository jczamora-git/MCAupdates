import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  onSubmit?: () => void;
  disabled?: boolean;
}

export function NumericKeypad({
  value,
  onChange,
  maxLength = 6, // Always 6 digits
  onSubmit,
  disabled = false,
}: NumericKeypadProps) {
  const handleDigit = (digit: string) => {
    if (value.length < maxLength && !disabled) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    if (value.length > 0 && !disabled) {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (!disabled) {
      onChange('');
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* PIN Display */}
      <div className="mb-6">
        <div className="flex justify-center gap-2 mb-3">
          {Array.from({ length: maxLength }).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                i < value.length
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {i < value.length && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-gray-500">
          {value.length}/{maxLength} digits
        </div>
      </div>

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {digits.map((digit) => (
          <Button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            disabled={disabled}
            className="h-14 text-xl font-semibold bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm hover:shadow-md transition-all active:scale-95"
            variant="outline"
          >
            {digit}
          </Button>
        ))}

        {/* Clear Button */}
        <Button
          type="button"
          onClick={handleClear}
          disabled={disabled || value.length === 0}
          className="h-14 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-sm hover:shadow-md transition-all active:scale-95"
          variant="outline"
        >
          <span className="text-xs font-medium">Clear</span>
        </Button>

        {/* Zero Button */}
        <Button
          type="button"
          onClick={() => handleDigit('0')}
          disabled={disabled}
          className="h-14 text-xl font-semibold bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm hover:shadow-md transition-all active:scale-95"
          variant="outline"
        >
          0
        </Button>

        {/* Backspace Button */}
        <Button
          type="button"
          onClick={handleBackspace}
          disabled={disabled || value.length === 0}
          className="h-14 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm hover:shadow-md transition-all active:scale-95"
          variant="outline"
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>

      {/* Submit Button */}
      {onSubmit && (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={disabled || value.length !== 6}
          className="w-full mt-5 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all active:scale-95"
        >
          Continue
        </Button>
      )}
    </div>
  );
}
