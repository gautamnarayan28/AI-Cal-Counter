import SwiftUI
import CalorieCore

enum Palette {
    static let cream = Color(red: 1, green: 1, blue: 245/255)
    static let blue = Color(red: 49/255, green: 86/255, blue: 163/255)
    static let ink = Color(red: 25/255, green: 25/255, blue: 21/255)
    static func font(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font { .custom("GeneralSans-Regular", size: size, relativeTo: style) }
    // The web build uses the 500 weight only for the profile button; mirror that here.
    static func medium(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font { .custom("GeneralSans-Medium", size: size, relativeTo: style) }
}
enum JournalTab: String, CaseIterable { case home, logs, progress, insights }
struct JournalRoot: View {
    @EnvironmentObject private var store: JournalStore
    @State private var selected: JournalTab = .home
    var body: some View {
        ZStack {
            Palette.cream.ignoresSafeArea()
            Group {
                switch selected {
                case .home: HomeScreen()
                case .logs: LogsScreen()
                case .progress, .insights: ComingSoonScreen(title: selected.rawValue)
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 4) {
                    ForEach(JournalTab.allCases, id: \.self) { tab in
                        Button { selected = tab } label: {
                            VStack(spacing: 4) {
                                Image(tab.rawValue).resizable().frame(width: tab == .home ? 70 : 76, height: tab == .home ? 70 : 76)
                                    .frame(width: 40, height: 40).clipped().blendMode(.multiply)
                                Text(tab.rawValue).font(Palette.font(12, relativeTo: .caption))
                            }
                            .frame(maxWidth: .infinity, minHeight: 66)
                            .foregroundStyle(selected == tab ? Palette.blue : .secondary)
                            .background(selected == tab ? Palette.blue.opacity(0.06) : .clear, in: RoundedRectangle(cornerRadius: 18))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(tab.rawValue)
                        .accessibilityAddTraits(selected == tab ? [.isSelected] : [])
                    }
                }
                .padding(7).frame(maxWidth: 320)
                .background(Palette.cream.opacity(0.97), in: RoundedRectangle(cornerRadius: 25))
                .overlay(RoundedRectangle(cornerRadius: 25).stroke(Palette.ink.opacity(0.1)))
                .shadow(color: Palette.ink.opacity(0.08), radius: 16, y: 8)
                .padding(.horizontal, 24).padding(.bottom, 8)
            }
        }
        .font(Palette.font(16)).foregroundStyle(Palette.ink)
        .alert("something needs attention", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
            Button("ok") { store.error = nil }
        } message: { Text(store.error ?? "") }
    }
}
struct PaperCircle: View {
    var body: some View {
        Circle().fill(RadialGradient(colors: [.white, Palette.cream, Color(red: 238/255, green: 238/255, blue: 226/255)], center: .topLeading, startRadius: 0, endRadius: 290))
            .overlay {
                Canvas { context, size in
                    for x in stride(from: 0.0, to: size.width, by: 3) {
                        for y in stride(from: 0.0, to: size.height, by: 3) {
                            context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 0.7, height: 0.7)), with: .color(Palette.ink.opacity(0.05)))
                        }
                    }
                }.clipShape(Circle()).accessibilityHidden(true)
            }
            .shadow(color: Palette.ink.opacity(0.1), radius: 15, y: 12)
    }
}
struct DotField: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        TimelineView(.animation(minimumInterval: 1/20, paused: reduceMotion)) { timeline in
            let phase = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 8) / 8
            Canvas { context, size in
                for x in stride(from: -10.0, to: size.width+10, by: 10) {
                    for y in stride(from: -10.0, to: size.height+10, by: 10) {
                        context.fill(Path(ellipseIn: CGRect(x: x+phase*10, y: y-phase*10, width: 2, height: 2)), with: .color(Palette.blue.opacity(0.65)))
                    }
                }
            }.mask(Ellipse().fill(RadialGradient(colors: [.black, .clear], center: .center, startRadius: 60, endRadius: 185)))
        }.accessibilityHidden(true)
    }
}
struct HomeScreen: View {
    @EnvironmentObject private var store: JournalStore
    @State private var showFoods = false
    @State private var showSettings = false
    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { timeline in
            let eaten = store.state.consumed(on: timeline.date)
            let remaining = store.state.dailyTarget-eaten
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack {
                        Circle().fill(Palette.blue).frame(width: 6, height: 6)
                        Text(timeline.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)).lowercased())
                            .font(Palette.font(12, relativeTo: .caption)).foregroundStyle(.secondary)
                        Spacer()
                        Button { showSettings = true } label: {
                            Text("gn").font(Palette.medium(14)).foregroundStyle(Palette.blue).frame(width: 44, height: 44).background(PaperCircle())
                        }.accessibilityLabel("settings")
                    }
                    Text("today").font(Palette.font(15)).foregroundStyle(.secondary)
                    ZStack {
                        DotField().frame(height: 290)
                        PaperCircle().frame(width: 250, height: 250)
                        VStack(spacing: 10) {
                            Text(remaining < 0 ? "over target" : "calories left").foregroundStyle(.secondary)
                            Text(abs(remaining), format: .number.precision(.fractionLength(0)))
                                .font(Palette.font(64, relativeTo: .largeTitle)).minimumScaleFactor(0.5).lineLimit(1)
                            Text("kcal").font(Palette.font(13, relativeTo: .caption)).foregroundStyle(.secondary)
                        }.padding(25).frame(width: 250)
                    }.frame(maxWidth: .infinity)
                    HStack {
                        Circle().fill(Palette.blue).frame(width: 6, height: 6)
                        Text("eaten")
                        Text(eaten, format: .number.precision(.fractionLength(0)))
                        Spacer()
                        Text("target")
                        Text(store.state.dailyTarget, format: .number.precision(.fractionLength(0)))
                    }.font(Palette.font(14))
                    Divider()
                    Text("what did you eat?").font(Palette.font(18))
                    Button { showFoods = true } label: {
                        HStack {
                            Image(systemName: "magnifyingglass")
                            Text("choose a food").foregroundStyle(.secondary)
                            Spacer()
                            Image(systemName: "plus").frame(width: 36, height: 36).background(Palette.blue.opacity(0.08), in: Circle())
                        }.padding(10).background(.white.opacity(0.6), in: Capsule())
                            .overlay(Capsule().stroke(Palette.ink.opacity(0.12)))
                    }.disabled(!store.storageReady || store.foods.isEmpty)
                    Text("saved on this iphone").font(Palette.font(12, relativeTo: .caption)).foregroundStyle(.secondary)
                }.padding(.horizontal, 26).padding(.top, 12).padding(.bottom, 24)
            }
        }
        .sheet(isPresented: $showFoods) { FoodPicker() }
        .sheet(isPresented: $showSettings) { SettingsScreen() }
    }
}
struct FoodPicker: View {
    @EnvironmentObject private var store: JournalStore
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selected: FoodReference?
    var results: [FoodReference] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? store.foods : store.foods.filter { $0.name.localizedStandardContains(trimmed) }
    }
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("search food names, then choose a portion. ai meal descriptions will come later.").font(Palette.font(14)).foregroundStyle(.secondary)
                }
                if results.isEmpty { Text("no food names found") }
                ForEach(results) { food in
                    Button { selected=food } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(food.name.lowercased()).foregroundStyle(Palette.ink)
                            Text("indb · \(food.servingUsable ? food.servingUnit ?? "serving" : "weight required")")
                                .font(Palette.font(12, relativeTo: .caption)).foregroundStyle(.secondary)
                        }.padding(.vertical, 5)
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.cream)
            .searchable(text: $query, prompt: "search food names")
            .navigationTitle("choose a food").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("close") { dismiss() } } }
            .sheet(item: $selected) { food in MealEditor(food: food) { dismiss() } }
        }.font(Palette.font(16))
    }
}
struct MealEditor: View {
    let food: FoodReference
    var existing: JournalMeal? = nil
    var onSaved: () -> Void = {}
    @EnvironmentObject private var store: JournalStore
    @Environment(\.dismiss) private var dismiss
    @State private var amount = "1"
    @State private var basis: PortionBasis = .servings
    @State private var date = Date()
    @State private var validationError: String?
    var quantity: Double? {
        let formatter = NumberFormatter(); formatter.numberStyle = .decimal
        return formatter.number(from: amount)?.doubleValue
    }
    var calculated: Double? { quantity.flatMap { try? food.calories(quantity: $0, basis: basis) } }
    var body: some View {
        NavigationStack {
            Form {
                Section { Text(food.name.lowercased()).font(Palette.font(22)) }
                Section("portion") {
                    Picker("measure", selection: $basis) {
                        if food.servingUsable { Text(food.servingUnit ?? "servings").tag(PortionBasis.servings) }
                        Text("grams").tag(PortionBasis.grams)
                    }.pickerStyle(.segmented)
                    TextField("quantity", text: $amount).keyboardType(.decimalPad)
                    DatePicker("when", selection: $date)
                }
                Section("estimated calories") {
                    if let calculated { Text(calculated, format: .number.precision(.fractionLength(0))).font(Palette.font(42)) }
                    else { Text("enter a valid portion").foregroundStyle(.secondary) }
                    Text("indb reference recipe · \(food.id)").font(Palette.font(13))
                    Text("your portion and preparation may differ from this recipe.").font(Palette.font(14)).foregroundStyle(.secondary)
                }
                if let validationError { Text(validationError).foregroundStyle(Palette.blue) }
                Button(existing == nil ? "add to log" : "save changes") {
                    do {
                        guard let quantity else { throw JournalError.invalidQuantity }
                        let meal = try JournalMeal(id: existing?.id ?? UUID(), date: date, food: food, quantity: quantity, basis: basis)
                        if store.save(meal) { dismiss(); onSaved() }
                        else { validationError = store.error }
                    } catch { validationError = error.localizedDescription }
                }.disabled(calculated == nil || !store.storageReady)
            }
            .scrollContentBackground(.hidden).background(Palette.cream)
            .navigationTitle("review meal").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("cancel") { dismiss() } } }
        }
        .font(Palette.font(16))
        .onAppear {
            basis = existing?.basis ?? (food.servingUsable ? .servings : .grams)
            let formatter=NumberFormatter(); formatter.numberStyle = .decimal
            amount=formatter.string(from: NSNumber(value: existing?.quantity ?? (food.servingUsable ? 1 : 100))) ?? "1"
            date=existing?.date ?? Date()
        }
    }
}
struct LogsScreen: View {
    @EnvironmentObject private var store: JournalStore
    @State private var editing: JournalMeal?
    @State private var pendingDelete: JournalMeal?
    var days: [Date] { Set(store.state.meals.map { Calendar.current.startOfDay(for: $0.date) }).sorted(by: >) }
    var body: some View {
        NavigationStack {
            List {
                if store.state.meals.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("no meals yet").font(Palette.font(24))
                        Text("choose a food from home to start your journal").foregroundStyle(.secondary)
                    }.padding(.vertical, 24)
                }
                ForEach(days, id: \.self) { day in
                    Section {
                        ForEach(store.state.meals.filter { Calendar.current.isDate($0.date, inSameDayAs: day) }.sorted { $0.date > $1.date }) { meal in
                            Button { editing=meal } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(meal.food.name.lowercased()).foregroundStyle(Palette.ink)
                                        Text("\(meal.quantity.formatted()) \(meal.basis == .grams ? "g" : meal.food.servingUnit ?? "serving") · \(meal.date.formatted(date: .omitted, time: .shortened).lowercased())").font(Palette.font(12)).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(meal.calories, format: .number.precision(.fractionLength(0)))
                                }.padding(.vertical, 7)
                            }
                            .swipeActions { Button("delete", role: .destructive) { pendingDelete=meal } }
                        }
                    } header: {
                        HStack {
                            Text(Calendar.current.isDateInToday(day) ? "today" : day.formatted(date: .abbreviated, time: .omitted).lowercased())
                            Spacer()
                            Text("\(store.state.consumed(on: day).formatted(.number.precision(.fractionLength(0)))) kcal")
                        }
                    }
                }
            }.scrollContentBackground(.hidden).background(Palette.cream)
                .navigationTitle("your logs").navigationBarTitleDisplayMode(.inline)
        }
        .sheet(item: $editing) { meal in MealEditor(food: meal.food, existing: meal) }
        .confirmationDialog("delete this meal?", isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete=nil } })) {
            Button("delete meal", role: .destructive) { if let meal=pendingDelete { store.delete(meal) }; pendingDelete=nil }
        }
    }
}
struct SettingsScreen: View {
    @EnvironmentObject private var store: JournalStore
    @Environment(\.dismiss) private var dismiss
    @State private var target = ""
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section("daily target · kcal") { TextField("daily target", text: $target).keyboardType(.numberPad) }
                Section { Text("meals are saved on this iphone. account sync and ai estimates are not connected yet.").foregroundStyle(.secondary) }
                if let error { Text(error).foregroundStyle(Palette.blue) }
                Button("save") {
                    if let value=Double(target), store.setTarget(value) { dismiss() }
                    else { error=store.error ?? "enter a target between 500 and 10,000 kcal" }
                }
            }.scrollContentBackground(.hidden).background(Palette.cream)
                .navigationTitle("settings").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("close") { dismiss() } } }
        }.onAppear { target=String(Int(store.state.dailyTarget)) }.font(Palette.font(16))
    }
}
struct ComingSoonScreen: View {
    let title: String
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(title).font(Palette.font(15)).foregroundStyle(.secondary)
            Spacer()
            Circle().fill(Palette.blue).frame(width: 8, height: 8)
            Text("coming soon").font(Palette.font(38, relativeTo: .largeTitle))
            Spacer()
        }.frame(maxWidth: .infinity, alignment: .leading).padding(28)
    }
}
