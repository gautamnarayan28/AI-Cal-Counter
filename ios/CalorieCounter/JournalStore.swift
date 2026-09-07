import Foundation
import Combine
import CalorieCore

@MainActor final class JournalStore: ObservableObject {
    @Published private(set) var state = JournalSnapshot()
    @Published private(set) var foods: [FoodReference] = []
    @Published var error: String?
    @Published private(set) var storageReady = false
    private var file: JournalFile?
    init() {
        do {
            let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let storage = JournalFile(url: directory.appendingPathComponent("calorie-journal/meals.json"))
            state = try storage.load()
            file = storage
            storageReady = true
        } catch { self.error = "your saved meals could not be opened. \(error.localizedDescription)" }
        do {
            guard let url = Bundle.main.url(forResource: "foods", withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
            foods = try JSONDecoder().decode([FoodReference].self, from: Data(contentsOf: url))
        } catch { self.error = "the food database could not be opened. \(error.localizedDescription)" }
    }
    @discardableResult private func persist(_ next: JournalSnapshot) -> Bool {
        guard storageReady, let file else { error = "meal storage is unavailable; restart the app to retry"; return false }
        do { try file.save(next); state = next; return true }
        catch { self.error = "could not save changes. \(error.localizedDescription)"; return false }
    }
    func save(_ meal: JournalMeal) -> Bool {
        var next = state
        if let index = next.meals.firstIndex(where: { $0.id == meal.id }) { next.meals[index] = meal }
        else { next.meals.append(meal) }
        return persist(next)
    }
    func delete(_ meal: JournalMeal) { var next = state; next.meals.removeAll { $0.id == meal.id }; persist(next) }
    func setTarget(_ target: Double) -> Bool { var next = state; next.dailyTarget=target; return persist(next) }
}
