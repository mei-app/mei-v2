import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { List } from "@/lib/types";

export default function ListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    const { data, error } = await supabase
      .from("lists")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setLists(data || []);
    setLoading(false);
  };

  const createList = async () => {
    if (!newListName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("lists")
      .insert({ name: newListName.trim() })
      .select()
      .single();

    setCreating(false);

    if (error) {
      Alert.alert("Error", "couldn't create list");
    } else {
      setLists([data, ...lists]);
      setNewListName("");
      setModalVisible(false);
    }
  };

  const deleteList = (id: string) => {
    Alert.alert("delete list?", "this can't be undone", [
      { text: "cancel", style: "cancel" },
      {
        text: "delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("lists").delete().eq("id", id);
          setLists(lists.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-4 flex-row items-center gap-3 border-b border-black/10">
        <Text className="text-3xl font-black flex-1">mei</Text>
        <TouchableOpacity
          onPress={() => router.push("/browser")}
          hitSlop={8}
        >
          <Text className="text-2xl">🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-black px-4 py-2"
          onPress={() => setModalVisible(true)}
        >
          <Text className="text-white font-bold text-sm">+ new list</Text>
        </TouchableOpacity>
      </View>

      {/* Lists */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#000" />
        </View>
      ) : lists.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-2xl font-bold mb-2 text-center">no lists yet</Text>
          <Text className="text-black/50 text-center text-sm">
            create a list to start saving items from the web
          </Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="border-2 border-black p-4 flex-row items-center justify-between"
              onPress={() => router.push(`/list/${item.id}`)}
              onLongPress={() => deleteList(item.id)}
            >
              <Text className="text-lg font-bold">{item.name}</Text>
              <Text className="text-black/40 text-xl">→</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* New List Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-end"
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View className="bg-white px-6 pt-6 pb-12">
            <Text className="text-2xl font-bold mb-4">name your list</Text>
            <TextInput
              className="border-b-2 border-black text-xl pb-2 mb-6"
              placeholder="e.g. prom dresses, summer picks..."
              placeholderTextColor="#00000030"
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
              onSubmitEditing={createList}
            />
            <TouchableOpacity
              className="bg-black py-4 items-center"
              onPress={createList}
              disabled={creating || !newListName.trim()}
              style={{ opacity: creating || !newListName.trim() ? 0.4 : 1 }}
            >
              {creating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold">create list</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
