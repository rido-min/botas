import { ActivityType } from "./ActivityType";

export interface Activity {
    type: ActivityType |  string;
    [x:string] : any;
}