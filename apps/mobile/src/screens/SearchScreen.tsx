import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMobileStore } from "../store/mobileStore";
import { searchNotes } from "@daymark/core";
import type { RootStackParams } from "../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<RootStackParams>;

export function SearchScreen() {
  const nav = useNavigation<Nav>();
  const { notes, openNote } = useMobileStore();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return searchNotes(notes, query).slice(0, 30);
  }, [notes, query]);

  async function open(noteId: string) {
    await openNote(noteId);
    const note = useMobileStore.getState().notes.get(noteId);
    nav.navigate("Note", { noteId, title: note?.title });
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      <View style={s.searchBar}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes and tasks…"
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {query.length > 0 && results.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyText}>No results for "{query}"</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(r) => r.noteId}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.resultRow} onPress={() => open(item.noteId)}>
            <Text style={s.resultTitle} numberOfLines={1}>{item.noteTitle}</Text>
            <Text style={s.resultExcerpt} numberOfLines={2}>{item.excerpt}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon:  { fontSize: 16, color: "#555" },
  searchInput: { flex: 1, fontSize: 15, color: "#e8e8e8" },

  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  resultTitle:   { fontSize: 14, fontWeight: "600", color: "#e8e8e8", marginBottom: 3 },
  resultExcerpt: { fontSize: 12, color: "#888", lineHeight: 17 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: "#555" },
});
