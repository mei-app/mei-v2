import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4 pb-4 border-b border-black/10">
        <Text className="text-3xl font-black">profile</Text>
      </View>

      <View className="flex-1 px-6 pt-8">
        {email && (
          <View className="mb-8">
            <Text className="text-xs text-black/40 mb-1">signed in as</Text>
            <Text className="text-base font-medium">{email}</Text>
          </View>
        )}

        <TouchableOpacity
          className="border-2 border-black py-4 items-center"
          onPress={signOut}
        >
          <Text className="font-bold">sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
