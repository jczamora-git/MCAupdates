import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AccessLockedCardProps {
  title: string;
  description: string;
  benefits?: string[];
  benefitsTitle?: string;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

const AccessLockedCard = ({
  title,
  description,
  benefits = [
    "Secure your account and prevent unauthorized access",
    "Receive important updates and notifications",
    "Complete your enrollment process and pay tuition fees"
  ],
  benefitsTitle = "Why verify your email?",
  actionButton
}: AccessLockedCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto mt-20">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="pt-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center">
                  <Lock className="w-10 h-10 text-amber-700" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
              <p className="text-gray-600 mb-6">
                {description}
              </p>
              
              <Card className="border-0 bg-white mb-6">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Mail className="w-5 h-5 text-amber-600 flex-shrink-0 mt-1" />
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 mb-2">{benefitsTitle}</p>
                      <ul className="space-y-2">
                        {benefits.map((benefit, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="text-amber-600">•</span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={actionButton ? actionButton.onClick : () => navigate("/enrollee/dashboard")}
                className="bg-gradient-to-r from-primary to-accent text-white font-semibold"
              >
                {actionButton ? actionButton.label : "Back to Dashboard"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccessLockedCard;
