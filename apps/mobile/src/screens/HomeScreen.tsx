import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMobileStore } from "../store/mobileStore";
import { today, addDays, toISODate, fromISODate } from "@daymark/core";
import type { RootStackParams } from "../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<RootStackParams>;

const QUICK_DATES = [
  { label: "Yesterday", delta: -1 },
  { label: "Today",     delta: 0  },
  { label: "Tomorrow",  delta: 1  },
];

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { openDailyNote, recentIds, notes, initialized, init } = useMobileStore();

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  async function goToDate(delta: number) {
    const date = toISODate(addDays(fromISODate(today()), delta));
    await openDailyNote(date);
    const path = useMobileStore.getState().activeNoteId;
    if (path) {
      const note = useMobileStore.getState().notes.get(path);
      nav.navigate("Note", { noteId: path, title: note?.title });
    }
  }

  async function openNote(id: string) {
    await useMobileStore.getState().openNote(id);
    const note = useMobileStore.getState().notes.get(id);
    nav.navigate("Note", { noteId: id, title: note?.title });
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Daily notes quick access */}
        <Text style={s.sectionTitle}>DAILY NOTES</Text>
        <View style={s.quickRow}>
          {QUICK_DATES.map(({ label, delta }) => (
            <TouchableOpacity
              key={label}
              style={[s.quickCard, delta === 0 && s.quickCardToday]}
              onPress={() => goToDate(delta)}
            >
              <Text style={[s.quickLabel, delta === 0 && s.quickLabelToday]}>{label}</Text>
              <Text style={s.quickDate}>
                {toISODate(addDays(fromISODate(today()), delta)).slice(5)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent notes */}
        {recentIds.length > 0 && (
          <>
            <Text style={s.sectionTitle}>RECENT</Text>
            {recentIds.slice(0, 20).map((id) => {
              const note = notes.get(id);
              const filename = id.split("/").pop()?.replace(/\.md$/, "") ?? id;
              const taskCount = note?.tasks.filter((t) => t.state === "open").length ?? 0;
              return (
                <TouchableOpacity key={id} style={s.noteRow} onPress={() => openNote(id)}>
                  <View style={s.noteRowMain}>
                    <Text style={s.noteTitle} numberOfLines={1}>
                      {note?.title ?? filename}
                    </Text>
                    {taskCount > 0 && (
                      <View style={s.taskBadge}>
                        <Text style={s.taskBadgeText}>{taskCount}</Text>
                      </View>
                    )}
                  </View>
                  {note?.tags && note.tags.length > 0 && (
                    <Text style={s.noteTags} numberOfLines={1}>
                      {note.tags.slice(0, 3).map((t) => `#${t}`).join("  ")}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {!initialized && (
          <Text style={s.loading}>Loading notes…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },
  scroll:    { flex: 1 },

  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },

  quickRow:      { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  quickCard:     { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#2e2e2e" },
  quickCardToday:{ borderColor: "#7c6fff", backgroundColor: "rgba(124,111,255,0.08)" },
  quickLabel:    { fontSize: 13, fontWeight: "600", color: "#888", marginBottom: 4 },
  quickLabelToday: { color: "#7c6fff" },
  quickDate:     { fontSize: 11, color: "#555" },

  noteRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  noteRowMain:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  noteTitle:    { fontSize: 14, color: "#e8e8e8", flex: 1 },
  noteTags:     { fontSize: 11, color: "#4ade80", marginTop: 3 },
  taskBadge:    { backgroundColor: "rgba(124,111,255,0.15)", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  taskBadgeText:{ fontSize: 11, color: "#7c6fff", fontWeight: "700" },

  loading: { textAlign: "center", color: "#555", fontSize: 13, marginTop: 40 },
});
