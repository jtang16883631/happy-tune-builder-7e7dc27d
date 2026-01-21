import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, MessageSquare } from 'lucide-react';

const Chat = () => {
  const openGoogleChat = () => {
    window.open('https://chat.google.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle>Team Chat</CardTitle>
            <CardDescription>
              Connect with your team using Google Chat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openGoogleChat} size="lg" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Google Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Chat;
