import { notFound } from "next/navigation";
import { getPlayerById } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cake, Ruler, Scale, Shirt, Footprints, ArrowRightLeft } from "lucide-react";
import { SummaryTab } from "@/components/players/PlayerProfile/SummaryTab";
import { PhysicalTab } from "@/components/players/PlayerProfile/PhysicalTab";
import { TechnicalTab } from "@/components/players/PlayerProfile/TechnicalTab";
import { calculateAge } from "@/lib/utils";
import { TacticalTab } from "@/components/players/PlayerProfile/TacticalTab";
import { MedicalTab } from "@/components/players/PlayerProfile/MedicalTab";

type PlayerProfilePageProps = {
  params: {
    id: string;
  };
};

export default function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const player = getPlayerById(params.id);

  if (!player) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row gap-6">
        <Avatar className="h-32 w-32 border-4 border-card">
          <AvatarImage src={player.avatarUrl} data-ai-hint="person portrait" />
          <AvatarFallback className="text-4xl">{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Badge 
            variant={
              player.status === "active"
                ? "secondary"
                : player.status === "injured"
                ? "destructive"
                : "outline"
            }
            className={`mb-2 ${player.status === "active" ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""}`}
          >
            {player.status}
          </Badge>
          <h1 className="text-4xl font-bold font-headline">{player.firstName} {player.lastName}</h1>
          <p className="text-xl text-muted-foreground">{player.primaryPosition} • {player.category}</p>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
             <div className="flex items-center gap-1"><Cake className="h-4 w-4" /> {calculateAge(player.birthDate)} years old</div>
             <div className="flex items-center gap-1"><Ruler className="h-4 w-4" /> {player.height} cm</div>
             <div className="flex items-center gap-1"><Scale className="h-4 w-4" /> {player.weight} kg</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
            <Button>Edit Profile</Button>
            <Button variant="outline">Generate Report</Button>
        </div>
      </header>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-card">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="physical">Physical</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
          <TabsTrigger value="tactical">Tactical</TabsTrigger>
          <TabsTrigger value="medical">Medical</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <SummaryTab player={player} />
        </TabsContent>
        <TabsContent value="physical">
          <PhysicalTab player={player} />
        </TabsContent>
        <TabsContent value="technical">
          <TechnicalTab player={player} />
        </TabsContent>
        <TabsContent value="tactical">
          <TacticalTab player={player} />
        </TabsContent>
        <TabsContent value="medical">
           <MedicalTab player={player} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
