import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getMemberId, setMemberId } from "@/lib/member";
import type { List } from "@/lib/types";

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [list, setList] = useState<List | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    resolveToken();
  }, [token]);

  const resolveToken = async () => {
    const { data: share } = await supabase
      .from("list_shares")
      .select("list_id")
      .eq("token", token)
      .single();

    if (!share) {
      Alert.alert("invite expired", "this link is no longer valid");
      router.replace("/(tabs)");
      return;
    }

    // Check if already joined
    const existing = await getMemberId(share.list_id);
    if (existing) {
      router.replace({ pathname: "/list/[listId]", params: { listId: share.list_id } });
      return;
    }

    const { data: listData } = await supabase
      .from("lists")
      .select("*")
      .eq("id", share.list_id)
      .single();

    if (listData) setList(listData);
    setLoadingList(false);
  };

  const handleJoin = async () => {
    if (!name.trim() || !list) return;
    setJoining(true);

    const { data: member, error } = await supabase
      .from("list_members")
      .insert({ list_id: list.id, display_name: name.trim() })
      .select()
      .single();

    if (error || !member) {
      Alert.alert("Error", "couldn't join list");
      setJoining(false);
      return;
    }

    await setMemberId(list.id, member.id);
    router.replace({ pathname: "/list/[listId]", params: { listId: list.id } });
  };

  if (loadingList) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView className="flex-1 justify-center px-8">
        <Text className="text-4xl font-black mb-2">you're invited</Text>
        <Text className="text-black/50 text-base mb-12">
          to give feedback on{" "}
          <Text className="text-black font-bold">{list?.name}</Text>
        </Text>

        <Text className="text-sm font-semibold mb-2">what's your name?</Text>
        <TextInput
          className="border-b-2 border-black text-xl pb-2 mb-8"
          placeholder="your name..."
          placeholderTextColor="#00000030"
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          returnKeyType="go"
          onSubmitEditing={handleJoin}
        />

        <TouchableOpacity
          className="bg-black py-4 items-center"
          onPress={handleJoin}
          disabled={joining || !name.trim()}
          style={{ opacity: joining || !name.trim() ? 0.4 : 1 }}
        >
          {joining ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">join list</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
