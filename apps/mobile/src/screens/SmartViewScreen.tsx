import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  SafeAreaView, StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMobileStore, type SmartViewId } from "../store/mobileStore";
import { getOverdueTasks, getTodayTasks, getUpcomingTasks, type Task } from "@daymark/core";
import type { RootStackParams } from "../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<RootStackParams>;

const VIEWS: { id: SmartViewId; label: string; icon: string }[] = [
  { id: "today",    label: "Today",    icon: "◉" },
  { id: "overdue",  label: "Overdue",  icon: "⚠" },
  { id: "upcoming", label: "Upcoming", icon: "→" },
];

export function SmartViewScreen() {
  const nav = useNavigation<Nav>();
  const { notes, activeSmartView, openSmartView, openNote, init, initialized } = useMobileStore();
  const [selected, setSelected] = useState<SmartViewId>("today");

  useEffect(() => { if (!initialized) init(); }, [initialized, init]);

  const tasks = useMemo(() => {
    if (selected === "today")    return getTodayTasks(notes);
    if (selected === "overdue")  return getOverdueTasks(notes);
    if (selected === "upcoming") return getUpcomingTasks(notes, 7);
    return [];
  }, [notes, selected]);

  async function goToNote(noteId: string) {
    await openNote(noteId);
    const note = useMobileStore.getState().notes.get(noteId);
    nav.navigate("Note", { noteId, title: note?.title });
  }

  function renderTask({ item: task }: { item: Task }) {
    return (
      <View style={s.taskRow}>
        <View style={[s.taskCheck, task.state === "done" && s.taskCheckDone]}>
          {task.state === "done" && <Text style={s.checkmark}>✓</Text>}
        </View>
        <View style={s.taskBody}>
          <Text style={[s.taskContent, task.state === "done" && s.taskContentDone]} numberOfLines={2}>
            {task.content}
          </Text>
          <View style={s.taskMeta}>
            {task.dueDate && (
              <Text style={[s.taskMetaItem, s.taskDue]}>@due({task.dueDate})</Text>
            )}
            {task.scheduledDate && (
              <Text style={[s.taskMetaItem, s.taskScheduled]}>&gt;{task.scheduledDate}</Text>
            )}
            {task.tags.map((tag) => (
              <Text key={tag} style={[s.taskMetaItem, s.taskTag]}>#{tag}</Text>
            ))}
          </View>
          {task.noteDate && (
            <TouchableOpacity onPress={() => goToNote(`${useMobileStore.getState().vaultPath}/Daily/${task.noteDate?.replace(/-/g, "")}.md`)}>
              <Text style={s.taskNoteLink}>→ {task.noteDate}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Tab strip */}
      <View style={s.tabs}>
        {VIEWS.map(({ id, label, icon }) => {
          const count =
            id === "today"    ? getTodayTasks(notes).length :
            id === "overdue"  ? getOverdueTasks(notes).length :
            id === "upcoming" ? getUpcomingTasks(notes, 7).length : 0;
          return (
            <TouchableOpacity
              key={id}
              style={[s.tab, selected === id && s.tabActive]}
              onPress={() => setSelected(id)}
            >
              <Text style={[s.tabIcon, selected === id && s.tabIconActive]}>{icon}</Text>
              <Text style={[s.tabLabel, selected === id && s.tabLabelActive]}>{label}</Text>
              {count > 0 && (
                <View style={[s.tabBadge, id === "overdue" && s.tabBadgeRed]}>
                  <Text style={s.tabBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {tasks.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            {selected === "today" ? "No tasks for today" :
             selected === "overdue" ? "No overdue tasks" :
             "Nothing upcoming"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          renderItem={renderTask}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },

  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2e2e2e", backgroundColor: "#1a1a1a" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#7c6fff" },
  tabIcon:   { fontSize: 14, color: "#555" },
  tabIconActive: { color: "#7c6fff" },
  tabLabel:  { fontSize: 12, fontWeight: "600", color: "#555" },
  tabLabelActive: { color: "#7c6fff" },
  tabBadge:  { backgroundColor: "rgba(124,111,255,0.15)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 2 },
  tabBadgeRed: { backgroundColor: "rgba(251,146,60,0.15)" },
  tabBadgeText: { fontSize: 10, color: "#7c6fff", fontWeight: "700" },

  list: { paddingBottom: 20 },

  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
    gap: 12,
  },
  taskCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  taskCheckDone: { borderColor: "#7c6fff", backgroundColor: "rgba(124,111,255,0.15)" },
  checkmark: { fontSize: 11, color: "#7c6fff", fontWeight: "700" },

  taskBody:  { flex: 1 },
  taskContent: { fontSize: 14, color: "#e8e8e8", lineHeight: 20 },
  taskContentDone: { color: "#555", textDecorationLine: "line-through" },

  taskMeta:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  taskMetaItem: { fontSize: 11 },
  taskDue:   { color: "#fb923c" },
  taskScheduled: { color: "#60a5fa" },
  taskTag:   { color: "#4ade80" },

  taskNoteLink: { fontSize: 11, color: "#7c6fff", marginTop: 3 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: "#555" },
});
