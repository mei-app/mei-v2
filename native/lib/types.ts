export interface List {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  price: string | null;
  brand: string | null;
  position: number;
  created_at: string;
}

export interface SwipeResult {
  id: string;
  list_id: string;
  item_id: string;
  decision: "yes" | "no";
  swiped_at: string;
}

export interface ListShare {
  id: string;
  list_id: string;
  token: string;
  created_at: string;
}

export interface ListMember {
  id: string;
  list_id: string;
  display_name: string;
  joined_at: string;
}

export interface ItemLike {
  id: string;
  item_id: string;
  member_id: string;
  created_at: string;
}

export interface ItemComment {
  id: string;
  item_id: string;
  member_id: string;
  content: string;
  created_at: string;
  // joined from list_members
  display_name?: string;
}
