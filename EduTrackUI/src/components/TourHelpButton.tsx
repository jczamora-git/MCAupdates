import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpCircle, Play } from 'lucide-react';

interface TourOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onStart: () => void;
}

interface TourHelpButtonProps {
  tourOptions: TourOption[];
  className?: string;
}

const TourHelpButton: React.FC<TourHelpButtonProps> = ({ tourOptions, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleStartTour = (onStart: () => void) => {
    setIsOpen(false);
    onStart();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          className={`fixed bottom-6 right-6 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-50 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 ${className}`}
          size="sm"
          title="Take a guided tour of this page"
          aria-label="Start page tour"
          style={{
            position: 'fixed',
            bottom: 'max(24px, 1.5rem)',
            right: 'max(24px, 1.5rem)',
            zIndex: 9999,
          }}
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 p-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            Choose a Tour
          </h3>
          <p className="text-xs text-gray-600">
            Select which guided tour you'd like to take to learn about different features.
          </p>
          <div className="space-y-3 pt-2">
            {tourOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                onClick={() => handleStartTour(option.onStart)}
              >
                <div className="flex-shrink-0 mt-1">
                  {option.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-gray-900">{option.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                </div>
                <Button size="sm" variant="ghost" className="flex-shrink-0 h-8 w-8 p-0">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TourHelpButton;