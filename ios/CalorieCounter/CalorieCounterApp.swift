import SwiftUI
@main struct CalorieCounterApp: App {
    @StateObject private var store = JournalStore()
    var body: some Scene {
        WindowGroup { JournalRoot().environmentObject(store).tint(Palette.blue).preferredColorScheme(.light) }
    }
}
